/**
 * workflow-load-test.js
 * ---------------------------------------------------------------------------
 * Realistic multi-step user workflow load test: Login -> Browse Jobs ->
 * Apply -> Start Conversation -> Send Message -> Notifications, exercised
 * across configurable concurrency levels (100/500/1000 VUs).
 *
 * Two scenarios, sharing ONE setup():
 *
 *   browse_at_scale   -- READ-ONLY: dashboard -> browse jobs -> notifications
 *                        -> conversations list. Ramps up to PEAK_VUS
 *                        (default 100; pass -e PEAK_VUS=500 or 1000 for the
 *                        larger runs). Safe at any scale -- no writes.
 *
 *   apply_and_message -- REAL MUTATIONS: apply to a job, start a
 *                        conversation, send a message. Deliberately small
 *                        and fixed (APPLY_VUS, default 5), independent of
 *                        PEAK_VUS -- see the README's "why apply/message
 *                        doesn't scale to 500/1000" section for the reasons
 *                        (data pollution, and the profile-completion /
 *                        email-verification preconditions apply() requires).
 *
 * ACCOUNT POOL, AND WHY LOGIN HAPPENS ONCE IN setup() -- NOT PER VU:
 * Every VU in a local k6 run shares this machine's single egress IP, and
 * the backend's auth tier allows only 10 logins / 15 minutes PER IP,
 * TOTAL -- regardless of how many different accounts you're logging into.
 * If each of up to 1000 VUs called login() independently, all but the
 * first ~10 would be rejected with 429 before browse_at_scale even got
 * started. Instead, setup() logs in ONCE per pooled account (see
 * CANDIDATE_POOL below), and hands the resulting tokens to every VU via
 * setup()'s return value -- k6's standard mechanism for sharing read-only
 * state across VUs. This also mirrors real behavior: people log in once
 * and stay logged in for a session, they don't re-authenticate before
 * every click.
 *
 * Because of that same auth budget, CANDIDATE_POOL must contain at most
 * config.rateLimits.auth.max (10 by default) accounts -- setup() logs in
 * every one of them in a tight loop, and would trip the auth limiter
 * itself if given more than that.
 *
 * WHAT "SUCCESS" LOOKS LIKE AT 500-1000 VUs:
 * A small pool of accounts means many VUs share the SAME userId, and
 * therefore the SAME candidate-tier rate-limit bucket (150 req/60s per
 * account). With N pooled accounts, the system-wide sustainable throughput
 * for candidate-tier endpoints is roughly N*150 requests per 60s -- well
 * below what 500 or 1000 concurrent VUs will attempt. You WILL see a
 * rising 429 rate as PEAK_VUS grows past that ceiling. That's the rate
 * limiter working correctly under real contention, not a bug in the test
 * -- checkRateAware() (shared/helpers.js) treats a 429 as a valid,
 * correctly-formed outcome rather than a failure, and the custom
 * `workflow_browse_rate_limited` metric tracks how often it happens so you
 * can see the real throughput ceiling instead of it being buried in a
 * generic failure count.
 *
 * Run:
 *   k6 run workflow-load-test.js \
 *     -e BASE_URL=https://jobsforwomen-266w.onrender.com \
 *     -e CANDIDATE_POOL="cand1@test.com:pass1,cand2@test.com:pass2" \
 *     -e PEAK_VUS=100          # then re-run with 500, then 1000
 * ---------------------------------------------------------------------------
 */
import { sleep, fail } from "k6";
import { Counter } from "k6/metrics";
import { config } from "./shared/config.js";
import {
  getAuthToken,
  authGet,
  authPost,
  checkRateAware,
  checkStatus,
  currentUserId,
  logInfo,
  logWarn,
  logError,
  sleepJitter,
  standardSummary,
  warmUp,
} from "./shared/helpers.js";

const EP = config.endpoints.candidate;
const CANDIDATE_TIER = config.rateLimits.candidate;
const SEARCH_TIER = config.rateLimits.search;

const PEAK_VUS = Number(__ENV.PEAK_VUS) || 100;
const APPLY_VUS = Number(__ENV.APPLY_VUS) || 5;
const HOLD_DURATION = __ENV.HOLD_DURATION || "1m";

// -----------------------------------------------------------------------
// Custom metrics
// -----------------------------------------------------------------------
const browseSuccess = new Counter("workflow_browse_success");
const browseRateLimited = new Counter("workflow_browse_rate_limited");
const browseUnexpected = new Counter("workflow_browse_unexpected");

const applicationsCreated = new Counter("workflow_applications_created");
const applicationsAlreadyExisted = new Counter("workflow_applications_already_existed_409");
const applicationsGated = new Counter("workflow_applications_gated_403");
const applicationsRateLimited = new Counter("workflow_applications_rate_limited_429");
const applicationsUnexpected = new Counter("workflow_applications_unexpected");

const conversationsStarted = new Counter("workflow_conversations_started");
const messagesSent = new Counter("workflow_messages_sent");

export const options = {
  scenarios: {
    browse_at_scale: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "30s", target: Math.max(1, Math.ceil(PEAK_VUS * 0.5)) }, // ramp to half
        { duration: "30s", target: PEAK_VUS }, // ramp to peak
        { duration: HOLD_DURATION, target: PEAK_VUS }, // hold at peak
        { duration: "20s", target: 0 }, // ramp down
      ],
      exec: "browseWorkflow",
      gracefulRampDown: "10s",
    },
    apply_and_message: {
      executor: "constant-vus",
      vus: APPLY_VUS,
      duration: "30s",
      exec: "applyAndMessageWorkflow",
      startTime: "0s",
    },
  },
  thresholds: {
    // Deliberately loose / informational at scale -- see the module doc
    // comment above on why a clean 100% success rate is mathematically
    // impossible once concurrent demand exceeds the pool's combined
    // rate-limit budget, and isn't the point of this test anyway.
    checks: ["rate>0.80"],
    // http_req_failed only counts genuine transport-level failures by
    // default (DNS/TLS/connection errors), NOT 4xx/5xx status codes -- so
    // this stays a meaningful signal for real infrastructure problems even
    // though 429s are expected and common here.
    http_req_failed: ["rate<0.05"],
  },
};

export function setup() {
  const pool = config.credentials.candidatePool;
  if (pool.length === 0) {
    fail(
      'No candidate credentials available. Set CANDIDATE_POOL (preferred, e.g. -e CANDIDATE_POOL="a@test.com:pw1,b@test.com:pw2") or CANDIDATE_EMAIL/CANDIDATE_PASSWORD.'
    );
  }
  if (pool.length > config.rateLimits.auth.max) {
    logWarn(
      "workflow-setup",
      `CANDIDATE_POOL has ${pool.length} accounts, but the auth tier only allows ${config.rateLimits.auth.max} logins per ${
        config.rateLimits.auth.windowSec / 60
      }min per IP. Logging in all of them here will itself trip the auth rate limiter. Trim the pool to <= ${config.rateLimits.auth.max} accounts.`
    );
  }

  warmUp();

  const sessions = [];
  for (const cred of pool) {
    const token = getAuthToken(cred.email, cred.password, `pool:${cred.email}`);
    sessions.push({ email: cred.email, token, userId: currentUserId(token) });
  }

  logInfo(
    "workflow-setup",
    `Authenticated ${sessions.length} pooled account(s): [${sessions.map((s) => s.userId).join(", ")}]. browse_at_scale will ramp to ${PEAK_VUS} VUs sharing this pool -- expect rising 429s from the candidate tier (${
      CANDIDATE_TIER.max
    } req/${CANDIDATE_TIER.windowSec}s per account) once concurrent demand exceeds roughly ${sessions.length * CANDIDATE_TIER.max} requests/${
      CANDIDATE_TIER.windowSec
    }s system-wide. That's the expected throughput ceiling, not a bug -- see the workflow_*_rate_limited metrics in the summary.`
  );

  // Tokens are minted with a 15-minute expiry and are NOT refreshed
  // mid-run (setup() runs once, at the very start of the whole test) --
  // keep total run duration (all stages + hold, across BOTH scenarios)
  // comfortably under 15 minutes, or split a longer soak into multiple
  // shorter k6 invocations.
  return { sessions };
}

function pickSession(sessions) {
  // __VU is k6's 1-indexed current virtual-user number, unique for the
  // life of the run. Round-robin across the pool so many VUs share a
  // small number of real accounts.
  return sessions[(__VU - 1) % sessions.length];
}

function tally(status, successCounter, rateLimitedCounter, unexpectedCounter) {
  if (status === 429) rateLimitedCounter.add(1);
  else if (status >= 200 && status < 300) successCounter.add(1);
  else unexpectedCounter.add(1);
}

// -------------------------------------------------------------------
// Scenario 1: browse_at_scale -- read-only, safe at any concurrency.
// -------------------------------------------------------------------
export function browseWorkflow(data) {
  const session = pickSession(data.sessions);
  const token = session.token;

  const dashRes = authGet(EP.dashboard, token, "workflow_dashboard");
  const dash = checkRateAware(dashRes, "workflow dashboard", CANDIDATE_TIER.max);
  tally(dash.status, browseSuccess, browseRateLimited, browseUnexpected);
  sleep(sleepJitter(0.5));

  // /candidates/jobs is re-tiered to the search limiter (IP-keyed, 300/60s)
  // -- NOT the candidate tier -- see candidate.routes.ts. Every VU shares
  // one IP-keyed bucket here regardless of which pooled account it's using.
  const jobsRes = authGet(EP.jobs, token, "workflow_browse_jobs");
  const jobs = checkRateAware(jobsRes, "workflow browse jobs", SEARCH_TIER.max);
  tally(jobs.status, browseSuccess, browseRateLimited, browseUnexpected);
  sleep(sleepJitter(0.5));

  const notifRes = authGet(EP.notifications, token, "workflow_notifications");
  const notif = checkRateAware(notifRes, "workflow notifications", CANDIDATE_TIER.max);
  tally(notif.status, browseSuccess, browseRateLimited, browseUnexpected);
  sleep(sleepJitter(0.5));

  const convListRes = authGet(EP.conversations, token, "workflow_conversations_list");
  const convList = checkRateAware(convListRes, "workflow conversations list", CANDIDATE_TIER.max);
  tally(convList.status, browseSuccess, browseRateLimited, browseUnexpected);

  sleep(sleepJitter(1));
}

// -------------------------------------------------------------------
// Scenario 2: apply_and_message -- real mutations, deliberately small.
// -------------------------------------------------------------------
export function applyAndMessageWorkflow(data) {
  const session = pickSession(data.sessions);
  const token = session.token;

  const jobsRes = authGet(EP.jobs, token, "workflow_apply_browse_jobs");
  checkRateAware(jobsRes, "workflow apply-flow browse jobs", SEARCH_TIER.max);

  let applicationId = null;

  if (jobsRes.status === 200) {
    let jobs = [];
    try {
      jobs = JSON.parse(jobsRes.body).data.jobs || [];
    } catch (e) {
      logError("workflow", `Could not parse jobs listing body: ${e}`);
    }

    if (jobs.length > 0) {
      const job = jobs[0];
      const applyRes = authPost(`${EP.jobs}/${job.id}/apply`, token, {}, "workflow_apply");

      if (applyRes.status === 201) {
        applicationsCreated.add(1);
        checkStatus(applyRes, [201], "workflow apply (new application)");
        try {
          applicationId = JSON.parse(applyRes.body).data.application.id;
        } catch (e) {
          logError("workflow", `Apply succeeded (201) but response body didn't parse: ${e}`);
        }
      } else if (applyRes.status === 409) {
        // errorHandler.ts maps "already applied" -> 409. Expected on
        // repeat runs against the same pooled account -- not a failure.
        applicationsAlreadyExisted.add(1);
        logInfo("workflow", `Already applied to job ${job.id} (409) -- expected on repeat runs. Falling back to an existing application for the message steps.`);
      } else if (applyRes.status === 403) {
        // requireVerifiedEmail / requireProfileCompleted gate
        // (rbac.middleware.ts). An account-precondition issue, not a
        // script bug -- see the README's account-setup notes.
        applicationsGated.add(1);
        logWarn(
          "workflow",
          `Apply blocked by a precondition (403): ${applyRes.body ? applyRes.body.substring(0, 200) : ""}. This pooled account needs a verified email and a >=70%-complete profile for apply/message to fully exercise.`
        );
      } else if (applyRes.status === 429) {
        applicationsRateLimited.add(1);
        logInfo("workflow", `Apply rate-limited (429) -- expected once ${APPLY_VUS} VUs share this account's ${CANDIDATE_TIER.max}/${CANDIDATE_TIER.windowSec}s budget.`);
      } else {
        applicationsUnexpected.add(1);
        checkStatus(applyRes, [201, 403, 409, 429], "workflow apply (unexpected status)");
        logError("workflow", `Apply returned an unexpected status ${applyRes.status}: ${applyRes.body ? applyRes.body.substring(0, 200) : ""}`);
      }
    } else {
      logWarn("workflow", "No jobs available in the catalog -- skipping apply for this iteration.");
    }
  }

  // Fall back to an existing application (from an earlier run, or the 409
  // case above) so the message steps below still get real coverage even
  // when this iteration didn't produce a fresh application.
  if (!applicationId) {
    const appsRes = authGet(EP.applications, token, "workflow_get_applications");
    checkRateAware(appsRes, "workflow get applications", CANDIDATE_TIER.max);
    if (appsRes.status === 200) {
      try {
        const apps = JSON.parse(appsRes.body).data.applications || [];
        if (apps.length > 0) applicationId = apps[0].id;
      } catch (e) {
        logError("workflow", `Could not parse applications list body: ${e}`);
      }
    }
  }

  if (applicationId) {
    const convRes = authPost(`${EP.applications}/${applicationId}/conversation`, token, {}, "workflow_start_conversation");
    const conv = checkRateAware(convRes, "workflow start conversation", CANDIDATE_TIER.max, [201]);

    let conversationId = null;
    if (conv.status === 201) {
      conversationsStarted.add(1);
      try {
        conversationId = JSON.parse(convRes.body).data.conversation.id;
      } catch (e) {
        logError("workflow", `Conversation started (201) but response body didn't parse: ${e}`);
      }
    }

    if (conversationId) {
      const msgRes = authPost(
        `${EP.conversations}/${conversationId}/messages`,
        token,
        { content: `k6 load test message ${new Date().toISOString()}` },
        "workflow_send_message"
      );
      const msg = checkRateAware(msgRes, "workflow send message", CANDIDATE_TIER.max, [201]);
      if (msg.status === 201) messagesSent.add(1);
    }
  } else {
    logWarn("workflow", "No application (fresh or existing) available -- skipping conversation/message steps for this iteration.");
  }

  sleep(sleepJitter(1));
}

export function handleSummary(data) {
  return standardSummary(
    data,
    `WORKFLOW LOAD TEST SUMMARY (browse peak=${PEAK_VUS} VUs, apply/message=${APPLY_VUS} VUs)`,
    "workflow-load-test-summary.json"
  );
}

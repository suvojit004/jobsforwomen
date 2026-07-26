/**
 * global-rate-limit.js
 * ---------------------------------------------------------------------------
 * Verifies the GLOBAL rate limit tier: 100 requests / 60s, keyed by IP,
 * applied in front of every route (see backend/src/app.ts:
 * `app.use(rateLimitMiddleware)`, wired before any router).
 *
 * Target endpoint: GET /health -- public, cheap, deterministic (always 200
 * while the service is healthy), and still sits behind the global limiter
 * since app.use(rateLimitMiddleware) is registered before app.get("/health").
 *
 * Design note: this script deliberately runs as a SINGLE VU, SEQUENTIAL flow
 * rather than many concurrent VUs. A fixed-window counter is a shared,
 * mutable piece of state -- testing its boundary (request #100 succeeds,
 * #101 doesn't) needs strict ordering to be deterministic. Concurrent-load
 * behavior against Redis is covered separately in stress-test.js.
 *
 * Run:
 *   k6 run global-rate-limit.js -e BASE_URL=https://jobsforwomen-266w.onrender.com
 * ---------------------------------------------------------------------------
 */
import { sleep } from "k6";
import { Trend, Counter } from "k6/metrics";
import { config } from "./shared/config.js";
import {
  rootUrl,
  publicGet,
  checkStandard,
  checkRetryAfter,
  logInfo,
  logWarn,
  standardSummary,
  warmUp,
} from "./shared/helpers.js";

// Custom metrics surfaced in the summary in addition to k6's built-ins.
const successCount = new Counter("global_rl_success_responses");
const rejectedCount = new Counter("global_rl_429_responses");
const remainingAtBoundary = new Trend("global_rl_remaining_at_boundary", false);

const TIER = config.rateLimits.global; // { max: 100, windowSec: 60, keyedBy: 'ip' }
const HEALTH_URL = rootUrl(config.endpoints.health);

export const options = {
  scenarios: {
    global_tier_boundary: {
      executor: "shared-iterations",
      vus: 1,
      iterations: 1,
      // max(100 reqs + reset wait) with generous headroom for Render cold starts
      maxDuration: "3m",
      exec: "default",
    },
  },
  thresholds: {
    checks: ["rate>0.95"],
  },
};

export default function () {
  logInfo("global", `Testing global tier: ${TIER.max} req / ${TIER.windowSec}s against ${HEALTH_URL}`);

  // Tracks the most recent X-RateLimit-Reset seen from a SUCCESSFUL (200)
  // response. The backend's reject() path (rateLimit.middleware.ts) returns
  // before applyHeaders() ever runs, so a 429 response from this backend
  // never carries X-RateLimit-Reset -- only Retry-After. An earlier version
  // of this script tried to read the reset timestamp off the 429 responses
  // in Phase 2, which silently always evaluated to `undefined` and left
  // Phase 3 permanently falling back to the generic window-length wait.
  // Threading it from the success path instead (updated in both Phase 1 and
  // Phase 2's success branch) is the only place the backend actually sends it.
  let lastKnownReset = null;

  // -------------------------------------------------------------------
  // Phase 1 -- "requests below limit succeed"
  // Send a batch comfortably under the ceiling and confirm every one
  // succeeds with valid, decrementing rate-limit headers.
  // -------------------------------------------------------------------
  const belowLimitBatch = Math.floor(TIER.max * 0.5); // 50 of 100 by default
  let lastRemaining = null;
  let phase1Failures = 0;

  for (let i = 1; i <= belowLimitBatch; i++) {
    const res = publicGet(HEALTH_URL, "global_below_limit");
    const ok = checkStandard(res, `global below-limit #${i}`, { expectedStatuses: [200], expectedLimit: TIER.max, maxMs: 10000 });
    if (!ok) phase1Failures++;
    successCount.add(1);

    const remainingHeader = res.headers["X-Ratelimit-Remaining"] ?? res.headers["X-RateLimit-Remaining"];
    const resetHeader = res.headers["X-Ratelimit-Reset"] ?? res.headers["X-RateLimit-Reset"];
    if (resetHeader !== undefined) lastKnownReset = Number(resetHeader);
    if (remainingHeader !== undefined) {
      const remaining = Number(remainingHeader);
      if (lastRemaining !== null && remaining > lastRemaining) {
        logWarn("global", `Remaining increased between requests (${lastRemaining} -> ${remaining}) -- unexpected within one window.`);
      }
      lastRemaining = remaining;
    }
  }
  // Only claim success if the checks actually all passed -- printing this
  // unconditionally (as the previous version did) is exactly what made the
  // logs disagree with the real check results: the log line was a fixed
  // narration of the INTENDED outcome, not a report of the OBSERVED one.
  if (phase1Failures === 0) {
    logInfo("global", `Phase 1 complete: ${belowLimitBatch} requests sent, all succeeded, X-RateLimit-Remaining last seen = ${lastRemaining}.`);
  } else {
    logWarn("global", `Phase 1 finished with ${phase1Failures} FAILED assertion(s) out of ${belowLimitBatch} requests -- see [ERROR] lines above for specifics.`);
  }

  // -------------------------------------------------------------------
  // Phase 2 -- "exceeding limit returns 429"
  // Push the counter from belowLimitBatch up past TIER.max, then a few
  // requests further, confirming the exact boundary and 429 behavior.
  // -------------------------------------------------------------------
  const overshoot = 5;
  const remainingToBoundary = TIER.max - belowLimitBatch; // requests still allowed
  const phase2Total = remainingToBoundary + overshoot;
  let phase2Failures = 0;

  for (let i = 1; i <= phase2Total; i++) {
    const requestNumber = belowLimitBatch + i;
    const res = publicGet(HEALTH_URL, "global_boundary");

    if (requestNumber <= TIER.max) {
      const ok = checkStandard(res, `global boundary request #${requestNumber} (<= ${TIER.max}, should succeed)`, {
        expectedStatuses: [200],
        expectedLimit: TIER.max,
      });
      if (!ok) phase2Failures++;
      successCount.add(1);

      const resetHeader = res.headers["X-Ratelimit-Reset"] ?? res.headers["X-RateLimit-Reset"];
      if (resetHeader !== undefined) lastKnownReset = Number(resetHeader);

      if (requestNumber === TIER.max) {
        const remainingHeader = res.headers["X-Ratelimit-Remaining"] ?? res.headers["X-RateLimit-Remaining"];
        remainingAtBoundary.add(Number(remainingHeader ?? -1));
        logInfo("global", `Request #${TIER.max} (the last allowed in-window request) succeeded as expected, remaining=${remainingHeader}.`);
      }
    } else {
      // checkRetryAfter (not checkStandard/checkRateLimitHeaders) is the
      // correct check here -- see its doc comment in shared/helpers.js for
      // why a 429 from this backend never carries the X-RateLimit-* headers,
      // only Retry-After. It also now distinguishes a genuine assertion
      // mismatch from a transport-level failure (status 0 / res.error),
      // which previously would have failed identically and looked like a
      // broken rate limiter rather than a dropped connection.
      const { ok } = checkRetryAfter(res, `global request #${requestNumber} (> ${TIER.max}, should be rejected)`);
      if (!ok) phase2Failures++;
      rejectedCount.add(1);
    }
  }

  if (phase2Failures === 0) {
    logInfo("global", `Phase 2 complete: request #${TIER.max} succeeded, requests #${TIER.max + 1}..#${belowLimitBatch + phase2Total} correctly rejected with 429 -- all assertions passed.`);
  } else {
    logWarn(
      "global",
      `Phase 2 finished with ${phase2Failures} FAILED assertion(s) out of ${phase2Total} requests -- see the [ERROR] lines above (printed by checkStandard/checkRetryAfter) for exactly which request and which check failed. Do NOT read this as "correctly rejected" -- that requires phase2Failures === 0.`
    );
  }

  // -------------------------------------------------------------------
  // Phase 3 -- "reset works correctly"
  // Sleep until the window's X-RateLimit-Reset timestamp has passed, then
  // confirm a fresh request succeeds again with a replenished counter.
  // -------------------------------------------------------------------
  const nowSec = Date.now() / 1000;
  const waitSeconds = lastKnownReset ? Math.max(1, Math.ceil(lastKnownReset - nowSec) + 1) : TIER.windowSec + 1;
  logInfo("global", `Phase 3: sleeping ${waitSeconds}s for the rate-limit window to reset (derived from the last X-RateLimit-Reset seen on a successful response)...`);
  sleep(waitSeconds);

  const postResetRes = publicGet(HEALTH_URL, "global_post_reset");
  const postResetOk = checkStandard(postResetRes, "global post-reset request", { expectedStatuses: [200], expectedLimit: TIER.max });
  const postResetRemaining = Number(postResetRes.headers["X-Ratelimit-Remaining"] ?? postResetRes.headers["X-RateLimit-Remaining"] ?? -1);
  if (postResetOk) {
    logInfo("global", `Phase 3 complete: post-reset request succeeded with X-RateLimit-Remaining=${postResetRemaining} (expected close to ${TIER.max - 1}).`);
  } else {
    logWarn("global", `Phase 3 FAILED -- post-reset request did not pass all assertions (remaining=${postResetRemaining}). See [ERROR] lines above.`);
  }
  if (postResetRemaining < TIER.max - 5) {
    logWarn("global", `Post-reset remaining (${postResetRemaining}) is lower than expected -- window may not have fully reset, or another client shares this IP.`);
  }
}

export function handleSummary(data) {
  return standardSummary(data, "GLOBAL RATE LIMIT TEST SUMMARY (100 req / 60s, IP-keyed)", "global-rate-limit-summary.json");
}

/**
 * recruiter-rate-limit.js
 * ---------------------------------------------------------------------------
 * Verifies the RECRUITER rate limit tier: 150 requests / 60s, keyed by
 * authenticated User ID (backend's `recruiterRateLimiter`, applied via
 * `router.use(recruiterRateLimiter)` in recruiter.routes.ts to every
 * recruiter route EXCEPT the file-upload sub-routes, which layer the
 * stricter `uploadRateLimiter` on top -- see upload-rate-limit.js).
 *
 * Same three scenarios as candidate-rate-limit.js (functional / limit
 * enforcement / user isolation) -- see that file for the detailed design
 * rationale, which applies identically here. The two scripts are
 * intentionally parallel in structure since they exercise the same
 * limiter implementation with a different keyPrefix and route set.
 *
 * Requires RECRUITER_EMAIL/RECRUITER_PASSWORD for the primary account.
 * EMAIL/PASSWORD (generic) are used as the second account for the
 * isolation check, if provided -- must be a distinct Recruiter account, or
 * scenario 3 is skipped with a warning (not a hard failure).
 *
 * Run:
 *   k6 run recruiter-rate-limit.js \
 *     -e BASE_URL=https://jobsforwomen-266w.onrender.com \
 *     -e RECRUITER_EMAIL=recruiter@test.com -e RECRUITER_PASSWORD=pass123 \
 *     -e EMAIL=recruiter2@test.com -e PASSWORD=pass456
 * ---------------------------------------------------------------------------
 */
import { config } from "./shared/config.js";
import {
  getAuthToken,
  authGet,
  checkStandard,
  runTierBoundaryTest,
  currentUserId,
  logInfo,
  logWarn,
  standardSummary,
  warmUp,
} from "./shared/helpers.js";

const TIER = config.rateLimits.recruiter; // { max: 150, windowSec: 60, keyedBy: 'userId' }
const EP = config.endpoints.recruiter;

// Endpoints covered by recruiterRateLimiter (read-only, side-effect free --
// avoids the upload sub-routes, which are a different, stricter tier).
const FUNCTIONAL_ENDPOINTS = [
  { path: EP.dashboard, tag: "recruiter_dashboard" },
  { path: EP.analytics, tag: "recruiter_analytics" },
  { path: EP.settings, tag: "recruiter_settings" },
  { path: EP.notifications, tag: "recruiter_notifications" },
];

const BOUNDARY_ENDPOINT = EP.dashboard;

export const options = {
  scenarios: {
    recruiter_tier: {
      executor: "shared-iterations",
      vus: 1,
      iterations: 1,
      // 150+ sequential requests will trip the (stricter, 100/60s) global
      // guard at least once, adding a ~60s pause -- see shared/helpers.js's
      // guardGlobalBudget(). Generous ceiling to absorb that plus a
      // possible Render cold start.
      maxDuration: "5m",
      exec: "default",
    },
  },
  thresholds: {
    checks: ["rate>0.95"],
  },
};

export function setup() {
  warmUp();
  const primaryToken = getAuthToken(config.credentials.recruiter.email, config.credentials.recruiter.password, "recruiter_primary");

  let secondaryToken = null;
  const generic = config.credentials.generic;
  if (generic.email && generic.password && generic.email !== config.credentials.recruiter.email) {
    try {
      secondaryToken = getAuthToken(generic.email, generic.password, "recruiter_secondary");
    } catch (e) {
      logWarn("recruiter", `Could not authenticate secondary account for isolation check: ${e}`);
    }
  } else {
    logWarn("recruiter", "No distinct secondary account (EMAIL/PASSWORD) supplied -- user-isolation scenario will be skipped.");
  }

  return { primaryToken, secondaryToken };
}

export default function (data) {
  const { primaryToken, secondaryToken } = data;
  logInfo("recruiter", `Testing recruiter tier: ${TIER.max} req / ${TIER.windowSec}s, userId-keyed. Primary userId=${currentUserId(primaryToken)}.`);

  // -------------------------------------------------------------------
  // Scenario 1 -- functional
  // -------------------------------------------------------------------
  let consumed = 0;
  for (const ep of FUNCTIONAL_ENDPOINTS) {
    const res = authGet(ep.path, primaryToken, ep.tag);
    checkStandard(res, `recruiter functional: ${ep.tag}`, { expectedStatuses: [200], expectedLimit: TIER.max });
    consumed++;
  }
  logInfo("recruiter", `Scenario 1 complete: ${FUNCTIONAL_ENDPOINTS.length} functional endpoints all returned 200 with limit=${TIER.max}.`);

  // -------------------------------------------------------------------
  // Scenario 2 -- limit enforcement
  // -------------------------------------------------------------------
  const { lastReset } = runTierBoundaryTest({
    tierName: "recruiter",
    tier: TIER,
    alreadyConsumed: consumed,
    makeRequest: () => authGet(BOUNDARY_ENDPOINT, primaryToken, "recruiter_boundary"),
  });

  // -------------------------------------------------------------------
  // Scenario 3 -- user isolation
  // -------------------------------------------------------------------
  if (secondaryToken) {
    logInfo("recruiter", `Scenario 3: verifying isolation for secondary userId=${currentUserId(secondaryToken)} while primary is rate-limited.`);
    const secondaryRes = authGet(BOUNDARY_ENDPOINT, secondaryToken, "recruiter_isolation_check");
    checkStandard(secondaryRes, "recruiter isolation: secondary account request", { expectedStatuses: [200], expectedLimit: TIER.max });

    const secondaryRemaining = Number(secondaryRes.headers["X-Ratelimit-Remaining"] ?? secondaryRes.headers["X-RateLimit-Remaining"] ?? -1);
    if (secondaryRemaining < TIER.max - 10) {
      logWarn("recruiter", `Secondary account's remaining (${secondaryRemaining}) is surprisingly low for a first request -- confirm it's truly a separate, previously-unused account.`);
    } else {
      logInfo("recruiter", `Isolation confirmed: secondary account has an independent budget (remaining=${secondaryRemaining}) despite the primary account being exhausted.`);
    }
  } else {
    logWarn("recruiter", "Scenario 3 skipped (no secondary account available).");
  }

  logInfo("recruiter", `Test complete. Primary account is rate-limited until ~${lastReset ? new Date(lastReset * 1000).toISOString() : `${TIER.windowSec}s from first request`}.`);
}

export function handleSummary(data) {
  return standardSummary(data, "RECRUITER RATE LIMIT TEST SUMMARY (150 req / 60s, userId-keyed)", "recruiter-rate-limit-summary.json");
}

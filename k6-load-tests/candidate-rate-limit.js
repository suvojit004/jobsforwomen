/**
 * candidate-rate-limit.js
 * ---------------------------------------------------------------------------
 * Verifies the CANDIDATE rate limit tier: 150 requests / 60s, keyed by
 * authenticated User ID (backend's `candidateRateLimiter`, applied via
 * `router.use(candidateRateLimiter)` in candidate.routes.ts to every
 * candidate route EXCEPT /jobs*, which is re-tiered to the higher `search`
 * limiter -- see search-rate-limit.js for that one).
 *
 * Scenarios (mirrors the "Candidate" section of the test plan):
 *   1. Functional  -- a handful of real candidate endpoints return 200 with
 *      valid rate-limit headers reporting this tier's limit (150).
 *   2. Limit enforcement -- walk the same account's budget from wherever
 *      scenario 1 left it up through 150, confirming #150 succeeds and
 *      #151 is rejected with 429 + Retry-After.
 *   3. User isolation -- a SECOND candidate account (a different user ID)
 *      is still able to make requests even while the first account's
 *      budget is exhausted, proving the counters don't collide.
 *
 * Requires CANDIDATE_EMAIL/CANDIDATE_PASSWORD for the primary account.
 * EMAIL/PASSWORD (generic) are used as the second account for the
 * isolation check, if provided -- must be a distinct Candidate account, or
 * scenario 3 is skipped with a warning (not a hard failure).
 *
 * Run:
 *   k6 run candidate-rate-limit.js \
 *     -e BASE_URL=https://jobsforwomen-266w.onrender.com \
 *     -e CANDIDATE_EMAIL=candidate@test.com -e CANDIDATE_PASSWORD=pass123 \
 *     -e EMAIL=candidate2@test.com -e PASSWORD=pass456
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

const TIER = config.rateLimits.candidate; // { max: 150, windowSec: 60, keyedBy: 'userId' }
const EP = config.endpoints.candidate;

// Endpoints genuinely covered by candidateRateLimiter (read-only, side-effect
// free -- deliberately avoids /jobs*, which is search-tier, and avoids any
// POST/PUT/DELETE that would mutate real account data).
const FUNCTIONAL_ENDPOINTS = [
  { path: EP.dashboard, tag: "candidate_dashboard" },
  { path: EP.profile, tag: "candidate_profile" },
  { path: EP.settings, tag: "candidate_settings" },
  { path: EP.notifications, tag: "candidate_notifications" },
];

// The single endpoint used to walk the boundary in scenario 2/3 -- cheap,
// idempotent, GET-only.
const BOUNDARY_ENDPOINT = EP.dashboard;

export const options = {
  scenarios: {
    candidate_tier: {
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
  const primaryToken = getAuthToken(config.credentials.candidate.email, config.credentials.candidate.password, "candidate_primary");

  let secondaryToken = null;
  const generic = config.credentials.generic;
  if (generic.email && generic.password && generic.email !== config.credentials.candidate.email) {
    try {
      secondaryToken = getAuthToken(generic.email, generic.password, "candidate_secondary");
    } catch (e) {
      logWarn("candidate", `Could not authenticate secondary account for isolation check: ${e}`);
    }
  } else {
    logWarn("candidate", "No distinct secondary account (EMAIL/PASSWORD) supplied -- user-isolation scenario will be skipped.");
  }

  return { primaryToken, secondaryToken };
}

export default function (data) {
  const { primaryToken, secondaryToken } = data;
  logInfo("candidate", `Testing candidate tier: ${TIER.max} req / ${TIER.windowSec}s, userId-keyed. Primary userId=${currentUserId(primaryToken)}.`);

  // -------------------------------------------------------------------
  // Scenario 1 -- functional: candidate endpoints work and report the
  // candidate tier's limit.
  // -------------------------------------------------------------------
  let consumed = 0;
  for (const ep of FUNCTIONAL_ENDPOINTS) {
    const res = authGet(ep.path, primaryToken, ep.tag);
    checkStandard(res, `candidate functional: ${ep.tag}`, { expectedStatuses: [200], expectedLimit: TIER.max });
    consumed++;
  }
  logInfo("candidate", `Scenario 1 complete: ${FUNCTIONAL_ENDPOINTS.length} functional endpoints all returned 200 with limit=${TIER.max}.`);

  // -------------------------------------------------------------------
  // Scenario 2 -- limit enforcement: walk from `consumed` up through 150,
  // confirm #150 succeeds and #151 is rejected.
  // -------------------------------------------------------------------
  const { lastReset } = runTierBoundaryTest({
    tierName: "candidate",
    tier: TIER,
    alreadyConsumed: consumed,
    makeRequest: () => authGet(BOUNDARY_ENDPOINT, primaryToken, "candidate_boundary"),
  });

  // -------------------------------------------------------------------
  // Scenario 3 -- user isolation: a different user ID must still have a
  // fresh (or at least independent) budget while the primary account is
  // exhausted.
  // -------------------------------------------------------------------
  if (secondaryToken) {
    logInfo("candidate", `Scenario 3: verifying isolation for secondary userId=${currentUserId(secondaryToken)} while primary is rate-limited.`);
    const secondaryRes = authGet(BOUNDARY_ENDPOINT, secondaryToken, "candidate_isolation_check");
    checkStandard(secondaryRes, "candidate isolation: secondary account request", { expectedStatuses: [200], expectedLimit: TIER.max });

    const secondaryRemaining = Number(secondaryRes.headers["X-Ratelimit-Remaining"] ?? secondaryRes.headers["X-RateLimit-Remaining"] ?? -1);
    if (secondaryRemaining < TIER.max - 10) {
      logWarn("candidate", `Secondary account's remaining (${secondaryRemaining}) is surprisingly low for a first request -- confirm it's truly a separate, previously-unused account.`);
    } else {
      logInfo("candidate", `Isolation confirmed: secondary account has an independent budget (remaining=${secondaryRemaining}) despite the primary account being exhausted.`);
    }
  } else {
    logWarn("candidate", "Scenario 3 skipped (no secondary account available).");
  }

  logInfo("candidate", `Test complete. Primary account is rate-limited until ~${lastReset ? new Date(lastReset * 1000).toISOString() : `${TIER.windowSec}s from first request`}.`);
}

export function handleSummary(data) {
  return standardSummary(data, "CANDIDATE RATE LIMIT TEST SUMMARY (150 req / 60s, userId-keyed)", "candidate-rate-limit-summary.json");
}

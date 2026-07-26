/**
 * admin-rate-limit.js
 * ---------------------------------------------------------------------------
 * Verifies the ADMIN rate limit tier: 200 requests / 60s, keyed by
 * authenticated User ID (backend's `adminRateLimiter`, applied via
 * `router.use(adminRateLimiter)` in admin.routes.ts to every admin route).
 *
 * The admin router is mounted at /api/v1/admins (plural) in app.ts -- see
 * shared/config.js for the note on this vs. the singular path shown in
 * docs/08_API_REFERENCE.md.
 *
 * All admin routes require the caller to hold one of ADMIN_TIER_ROLES
 * ("Admin", "Super Admin", "Moderator", "Support Executive"). This script
 * sticks to endpoints reachable by ANY of those four roles (dashboard,
 * health, search, companies) rather than the narrower Admin/Super-Admin-only
 * routes (reports, audits, user management), so it works regardless of
 * which specific admin-tier role ADMIN_EMAIL/ADMIN_PASSWORD holds.
 *
 * Scenarios:
 *   1. Functional -- admin endpoints return 200 with valid rate-limit
 *      headers reporting this tier's limit (200).
 *   2. Limit enforcement -- walk the budget up through 200, confirming
 *      #200 succeeds and #201 is rejected with 429 + Retry-After.
 *
 * Run:
 *   k6 run admin-rate-limit.js \
 *     -e BASE_URL=https://jobsforwomen-266w.onrender.com \
 *     -e ADMIN_EMAIL=admin@test.com -e ADMIN_PASSWORD=pass123
 * ---------------------------------------------------------------------------
 */
import { config } from "./shared/config.js";
import { getAuthToken, authGet, checkStandard, runTierBoundaryTest, currentUserId, logInfo, standardSummary, warmUp } from "./shared/helpers.js";

const TIER = config.rateLimits.admin; // { max: 200, windowSec: 60, keyedBy: 'userId' }
const EP = config.endpoints.admin;

// Endpoints reachable by every ADMIN_TIER_ROLES member, read-only.
const FUNCTIONAL_ENDPOINTS = [
  { path: EP.dashboard, tag: "admin_dashboard" },
  { path: EP.health, tag: "admin_health" },
  { path: EP.search, tag: "admin_search" }, // still adminRateLimiter, not searchRateLimiter
  { path: EP.companies, tag: "admin_companies" },
];

const BOUNDARY_ENDPOINT = EP.dashboard;

export const options = {
  scenarios: {
    admin_tier: {
      executor: "shared-iterations",
      vus: 1,
      iterations: 1,
      // 200+ sequential requests will trip the (stricter, 100/60s) global
      // guard at least once (likely twice) -- see shared/helpers.js's
      // guardGlobalBudget(). Generous ceiling to absorb those pauses plus a
      // possible Render cold start.
      maxDuration: "6m",
      exec: "default",
    },
  },
  thresholds: {
    checks: ["rate>0.95"],
  },
};

export function setup() {
  warmUp();
  const token = getAuthToken(config.credentials.admin.email, config.credentials.admin.password, "admin_primary");
  return { token };
}

export default function (data) {
  const { token } = data;
  logInfo("admin", `Testing admin tier: ${TIER.max} req / ${TIER.windowSec}s, userId-keyed. userId=${currentUserId(token)}.`);

  // -------------------------------------------------------------------
  // Scenario 1 -- functional
  // -------------------------------------------------------------------
  let consumed = 0;
  for (const ep of FUNCTIONAL_ENDPOINTS) {
    const res = authGet(ep.path, token, ep.tag);
    checkStandard(res, `admin functional: ${ep.tag}`, { expectedStatuses: [200], expectedLimit: TIER.max });
    consumed++;
  }
  logInfo("admin", `Scenario 1 complete: ${FUNCTIONAL_ENDPOINTS.length} functional endpoints all returned 200 with limit=${TIER.max}.`);

  // -------------------------------------------------------------------
  // Scenario 2 -- limit enforcement (200 requests -- this is the largest
  // budget in the suite; expect this script to take longer to run).
  // -------------------------------------------------------------------
  const { lastReset } = runTierBoundaryTest({
    tierName: "admin",
    tier: TIER,
    alreadyConsumed: consumed,
    makeRequest: () => authGet(BOUNDARY_ENDPOINT, token, "admin_boundary"),
  });

  logInfo("admin", `Test complete. Account is rate-limited until ~${lastReset ? new Date(lastReset * 1000).toISOString() : `${TIER.windowSec}s from first request`}.`);
}

export function handleSummary(data) {
  return standardSummary(data, "ADMIN RATE LIMIT TEST SUMMARY (200 req / 60s, userId-keyed)", "admin-rate-limit-summary.json");
}

/**
 * search-rate-limit.js
 * ---------------------------------------------------------------------------
 * Verifies the SEARCH rate limit tier: 300 requests / 60s, keyed by IP
 * (backend's `searchRateLimiter`). In this codebase the only route wired to
 * it is GET /api/v1/candidates/jobs (candidate.routes.ts explicitly
 * re-tiers job search/browse away from the standard candidate limiter --
 * see the comment there: "legitimate paging/filtering fires many requests
 * quickly").
 *
 * Note this endpoint still requires authentication (candidate.routes.ts
 * applies `router.use(authenticateToken)` before any route, including
 * /jobs) even though the rate-limit KEY is the IP, not the user ID --
 * authentication and rate-limit identity are orthogonal here. An
 * unauthenticated request gets a 401 before it ever reaches the search
 * limiter (and consumes no budget), so this script logs in first purely to
 * be allowed to reach the endpoint at all.
 *
 * Because the limiter key is the IP, running this with many concurrent VUs
 * from the same machine is representative (they'd all legitimately share
 * one IP-keyed bucket) -- unlike the userId-keyed tiers, there's no
 * isolation to break here.
 *
 * Run:
 *   k6 run search-rate-limit.js \
 *     -e BASE_URL=https://jobsforwomen-266w.onrender.com \
 *     -e CANDIDATE_EMAIL=candidate@test.com -e CANDIDATE_PASSWORD=pass123
 * ---------------------------------------------------------------------------
 */
import { config } from "./shared/config.js";
import { getAuthToken, authGet, checkStandard, runTierBoundaryTest, logInfo, logWarn, standardSummary, warmUp } from "./shared/helpers.js";
import { Trend } from "k6/metrics";

const TIER = config.rateLimits.search; // { max: 300, windowSec: 60, keyedBy: 'ip' }
const JOBS_ENDPOINT = config.endpoints.candidate.jobs;

const remainingTrend = new Trend("search_rl_remaining_over_time", false);

export const options = {
  scenarios: {
    search_tier_boundary: {
      executor: "shared-iterations",
      vus: 1,
      iterations: 1,
      // 300+ sequential requests will trip the (stricter, 100/60s) global
      // guard multiple times -- see shared/helpers.js's guardGlobalBudget().
      // Generous ceiling to absorb those pauses plus a possible Render cold
      // start.
      maxDuration: "8m",
      exec: "default",
    },
  },
  thresholds: {
    checks: ["rate>0.95"],
  },
};

export function setup() {
  warmUp();
  // Any authenticated candidate works -- the limiter doesn't care which
  // user, only which IP.
  const token = getAuthToken(config.credentials.candidate.email, config.credentials.candidate.password, "search_candidate");
  return { token };
}

export default function (data) {
  const { token } = data;
  logInfo("search", `Testing search tier: ${TIER.max} req / ${TIER.windowSec}s, IP-keyed, via GET /candidates/jobs.`);

  const remainingSamples = [];

  const { lastReset } = runTierBoundaryTest({
    tierName: "search",
    tier: TIER,
    makeRequest: () => {
      const res = authGet(JOBS_ENDPOINT, token, "search_jobs");
      const remainingHeader = res.headers["X-Ratelimit-Remaining"] ?? res.headers["X-RateLimit-Remaining"];
      if (remainingHeader !== undefined) {
        const remaining = Number(remainingHeader);
        remainingTrend.add(remaining);
        remainingSamples.push(remaining);
      }
      return res;
    },
  });

  // -------------------------------------------------------------------
  // "headers decrease correctly" -- verify X-RateLimit-Remaining is
  // monotonically non-increasing across the sequence of successful
  // requests (it's reset to a fresh value only once we cross the 429
  // boundary, which is fine -- the trend that matters is *within* the
  // pre-boundary run).
  // -------------------------------------------------------------------
  let outOfOrder = 0;
  for (let i = 1; i < remainingSamples.length; i++) {
    if (remainingSamples[i] > remainingSamples[i - 1]) outOfOrder++;
  }
  if (outOfOrder === 0) {
    logInfo("search", `Header trend check passed: X-RateLimit-Remaining decreased monotonically across ${remainingSamples.length} samples.`);
  } else {
    logWarn("search", `Header trend check: ${outOfOrder} out of ${remainingSamples.length} samples saw remaining increase unexpectedly -- possible shared IP with other traffic, or a window boundary was crossed mid-run.`);
  }

  logInfo("search", `Test complete. IP is search-rate-limited until ~${lastReset ? new Date(lastReset * 1000).toISOString() : `${TIER.windowSec}s from first request`}.`);
}

export function handleSummary(data) {
  return standardSummary(data, "SEARCH RATE LIMIT TEST SUMMARY (300 req / 60s, IP-keyed)", "search-rate-limit-summary.json");
}

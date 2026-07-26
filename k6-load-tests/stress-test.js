/**
 * stress-test.js
 * ---------------------------------------------------------------------------
 * OPTIONAL: Redis-backed rate limiter correctness under concurrency.
 *
 * The other scripts in this suite deliberately use a single VU to make each
 * tier's boundary ("request #150 succeeds, #151 doesn't") trivially
 * deterministic to assert on. That's the right tool for verifying the
 * boundary is in the right PLACE, but it says nothing about whether the
 * counter stays CORRECT when many requests race each other at once -- which
 * is exactly the scenario Redis's atomic `INCR`
 * (rateLimit.middleware.ts: `await redis.incr(key)`) exists to make safe,
 * versus a naive read-then-write counter that would lose increments under
 * concurrency.
 *
 * WHY THIS TARGETS THE GLOBAL TIER SPECIFICALLY (GET /health):
 * app.use(rateLimitMiddleware) runs before every router is mounted, so
 * EVERY request from a given IP -- no matter which route -- is counted
 * against the global tier (100 req/60s) first. That makes the global tier
 * the one every concurrent VU on a single test machine (i.e. one shared
 * egress IP) will actually collide on; it will always bind before a
 * higher, per-role ceiling (candidate/recruiter 150, admin 200, search 300)
 * ever comes into play. Concentrating many concurrent VUs on ONE IP-keyed
 * bucket is exactly the race condition worth proving Redis handles
 * correctly, so this script leans into that rather than fighting it.
 *
 * This script fires many concurrent virtual users at GET /health and
 * checks that, however the allowed requests and subsequent 429s get
 * interleaved, the total count of successful (200) responses observed
 * never meaningfully exceeds the global tier's max -- i.e. the limiter
 * didn't "leak" extra allowances under load.
 *
 * WHAT THIS DOES *NOT* PROVE ON A SINGLE-INSTANCE DEPLOYMENT:
 * If the backend is running as a single server process (typical for a small
 * Render web service), an in-memory Map would *also* pass this test, since
 * there's only one process's memory to race against. Redis specifically
 * earns its keep when there are MULTIPLE server instances behind a load
 * balancer, each with its own separate in-memory fallback state -- a
 * horizontally-scaled deployment relying on in-memory counters instead of
 * Redis would FAIL this exact test, because each instance would
 * independently allow up to `max` requests, and the client-observed total
 * of successes would be roughly `max * instanceCount` instead of `max`.
 *
 * TO VALIDATE ACROSS MULTIPLE INSTANCES / DISTRIBUTED EXECUTION:
 *   - If the deployment is horizontally scaled, this same script already
 *     exercises that: your load balancer spreads the concurrent VUs'
 *     requests across instances, and Redis is what has to keep the count
 *     consistent regardless of which instance handled which request.
 *   - To generate load from multiple *client* machines/IPs (useful for
 *     confirming each source IP gets its own independent global bucket,
 *     i.e. that the IP-keying itself is correct), run this script
 *     simultaneously from several machines/CI runners against the same
 *     BASE_URL, or use k6 Cloud (`k6 cloud stress-test.js`) / xk6-disruptor
 *     / xk6-distributed to fan a single run out across multiple load
 *     generators with distinct egress IPs. See the README's "Redis /
 *     distributed execution" section for exact commands.
 *
 * Run:
 *   k6 run stress-test.js \
 *     -e BASE_URL=https://jobsforwomen-266w.onrender.com \
 *     -e STRESS_VUS=30 -e STRESS_DURATION=30s
 * ---------------------------------------------------------------------------
 */
import { config } from "./shared/config.js";
import { rootUrl, publicGet, checkRateLimitHeaders, checkRetryAfter, checkResponseTime, logInfo, logWarn, warmUp, standardSummary } from "./shared/helpers.js";
import { Counter } from "k6/metrics";

const TIER = config.rateLimits.global; // { max: 100, windowSec: 60, keyedBy: 'ip' }
const HEALTH_URL = rootUrl(config.endpoints.health);

const successCounter = new Counter("stress_success_responses");
const rejectedCounter = new Counter("stress_429_responses");
const unexpectedCounter = new Counter("stress_unexpected_responses");
const negativeRemainingCounter = new Counter("stress_negative_remaining_observed");

const STRESS_VUS = Number(__ENV.STRESS_VUS) || 30;
const STRESS_DURATION = __ENV.STRESS_DURATION || "30s";

export const options = {
  scenarios: {
    concurrent_burst: {
      executor: "constant-vus",
      vus: STRESS_VUS,
      duration: STRESS_DURATION,
      exec: "default",
    },
  },
  thresholds: {
    // Soft safety margin (+5) above the tier max to tolerate the single
    // legitimate race at the exact window boundary while still catching a
    // genuine "counter leaked allowances" bug (which would show up as
    // dozens of extra successes, not one or two).
    stress_success_responses: [`count<=${TIER.max + 5}`],
    stress_unexpected_responses: ["count==0"],
    stress_negative_remaining_observed: ["count==0"],
  },
};

export function setup() {
  warmUp();
  logInfo(
    "stress",
    `Starting concurrency stress test: ${STRESS_VUS} VUs for ${STRESS_DURATION} hammering ${HEALTH_URL} (global tier, IP-keyed, max=${TIER.max}/${TIER.windowSec}s). Expect a mix of 200s and 429s, not a clean split.`
  );
}

export default function () {
  const res = publicGet(HEALTH_URL, "stress_health");
  checkResponseTime(res, 15000, "stress request");

  // IMPORTANT: branch by status BEFORE deciding which checker to call.
  // A previous version of this function called checkRateLimitHeaders()
  // unconditionally on every response, 200 or 429. That's wrong: the
  // backend's reject() path (rateLimit.middleware.ts) returns before
  // applyHeaders() ever runs, so a 429 NEVER carries X-RateLimit-Limit/
  // Remaining/Reset -- only Retry-After. Checking for headers that the
  // backend never sends on that path made every 429 response in this
  // stress test fail those checks by construction, regardless of whether
  // the limiter was behaving correctly.
  if (res.status === 200) {
    const { remaining, ok } = checkRateLimitHeaders(res, "stress request (200)", TIER.max);
    successCounter.add(1);
    if (remaining !== null && remaining < 0) negativeRemainingCounter.add(1);
    if (!ok) unexpectedCounter.add(1); // a 200 with malformed headers is itself noteworthy
  } else if (res.status === 429) {
    const { ok } = checkRetryAfter(res, "stress request (429)");
    rejectedCounter.add(1);
    if (!ok) unexpectedCounter.add(1);
  } else {
    unexpectedCounter.add(1);
    logWarn("stress", `Unexpected status ${res.status} for a request that should only ever be 200 or 429. Body: ${res.body ? res.body.substring(0, 200) : "<empty>"}`);
  }
}

export function teardown() {
  logInfo(
    "stress",
    "Concurrency stress test complete. Check the summary below: 'stress_success_responses' should be close to (not far above) the tier max, and 'stress_unexpected_responses' / 'stress_negative_remaining_observed' should both be 0."
  );
}

export function handleSummary(data) {
  return standardSummary(data, "REDIS CONCURRENCY STRESS TEST SUMMARY (global tier, concurrent VUs, single shared IP)", "stress-test-summary.json");
}

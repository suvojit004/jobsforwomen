/**
 * auth-rate-limit.js
 * ---------------------------------------------------------------------------
 * Verifies the AUTHENTICATION rate limit tier: 10 requests / 15 minutes,
 * keyed by IP (backend/src/shared/middleware/rateLimit.middleware.ts's
 * `authRateLimiter`). Applied per-route (not router-wide) to every
 * credential-facing endpoint in backend/src/modules/auth/auth.routes.ts:
 * register/candidate, register/recruiter, verify-email, login, oauth,
 * google, google/callback, refresh, forgot-password, reset-password,
 * invitations/accept.
 *
 * This script exercises the tier through POST /auth/login specifically,
 * since it's the one endpoint that lets us deterministically produce both
 * "valid" and "invalid" attempts against the SAME 10-request bucket.
 *
 * IMPORTANT -- why this is a single VU, sequential script:
 * All of these endpoints share ONE budget per IP (10 requests / 15 minutes,
 * keyPrefix "auth"). Running concurrent VUs would race for the same 10
 * slots and make "the 11th request is 429" impossible to assert
 * deterministically. One VU, one iteration, one ordered sequence of
 * attempts is the only way to test this tier's boundary precisely.
 *
 * Because the budget is only 10 requests per 15 minutes, do NOT re-run this
 * script against the same target within 15 minutes unless you want to
 * observe "everything is 429" (which is itself a valid, if less
 * interesting, thing to verify).
 *
 * Run:
 *   k6 run auth-rate-limit.js \
 *     -e BASE_URL=https://jobsforwomen-266w.onrender.com \
 *     -e EMAIL=test@test.com -e PASSWORD=password123
 * ---------------------------------------------------------------------------
 */
import { config } from "./shared/config.js";
import {
  login,
  checkStandard,
  checkRetryAfter,
  checkStatus,
  checkRateLimitHeaders,
  logInfo,
  logWarn,
  standardSummary,
} from "./shared/helpers.js";
import { Counter } from "k6/metrics";

const TIER = config.rateLimits.auth; // { max: 10, windowSec: 900, keyedBy: 'ip' }

const invalidLoginCount = new Counter("auth_rl_invalid_login_responses");
const validLoginCount = new Counter("auth_rl_valid_login_responses");
const rejectedCount = new Counter("auth_rl_429_responses");

// A syntactically valid but almost-certainly-nonexistent address, used for
// the "invalid credentials" attempts so we don't depend on any specific
// account existing (and don't risk tripping account-lockout logic on a real
// user, since these are meant to fail on the login attempt only).
const INVALID_EMAIL = __ENV.INVALID_EMAIL || "k6-load-test-invalid-user@example.com";
const INVALID_PASSWORD = "not-the-real-password-123!";

export const options = {
  scenarios: {
    auth_tier_boundary: {
      executor: "shared-iterations",
      vus: 1,
      iterations: 1,
      maxDuration: "2m",
      exec: "default",
    },
  },
  thresholds: {
    checks: ["rate>0.95"],
  },
};

/** One login attempt + standard checks, returns the raw response. */
function attempt(n, expectedOutcome, email, password) {
  const res = login(email, password);
  const tag = `auth attempt #${n} (${expectedOutcome})`;

  if (expectedOutcome === "429") {
    checkRetryAfter(res, tag);
    rejectedCount.add(1);
  } else if (expectedOutcome === "invalid") {
    checkStatus(res, [401], tag);
    checkRateLimitHeaders(res, tag, TIER.max);
    invalidLoginCount.add(1);
  } else if (expectedOutcome === "valid") {
    checkStatus(res, [200], tag);
    checkRateLimitHeaders(res, tag, TIER.max);
    validLoginCount.add(1);
  }

  const remaining = res.headers["X-Ratelimit-Remaining"] ?? res.headers["X-RateLimit-Remaining"];
  logInfo("auth", `Attempt #${n}: status=${res.status} X-RateLimit-Remaining=${remaining ?? "n/a"}`);
  return res;
}

export default function () {
  const hasGenericCreds = Boolean(config.credentials.generic.email && config.credentials.generic.password);
  if (!hasGenericCreds) {
    logWarn(
      "auth",
      "EMAIL/PASSWORD not set -- the 'valid login counts toward the limit' scenario will be skipped in favor of an extra invalid attempt. Set -e EMAIL=... -e PASSWORD=... to exercise it."
    );
  }

  logInfo("auth", `Testing auth tier: ${TIER.max} req / ${TIER.windowSec}s (${TIER.windowSec / 60}min), IP-keyed, via POST /auth/login.`);

  let attemptNumber = 0;

  // -------------------------------------------------------------------
  // Attempts 1-5: invalid credentials. Each still consumes one slot of
  // the 10-request budget (the limiter runs before the credential check)
  // and must return 401 with valid, decrementing rate-limit headers.
  // -------------------------------------------------------------------
  for (let i = 0; i < 5; i++) {
    attemptNumber++;
    attempt(attemptNumber, "invalid", INVALID_EMAIL, INVALID_PASSWORD);
  }

  // -------------------------------------------------------------------
  // Attempt 6: a VALID login (if credentials were supplied). Proves valid
  // logins are counted against the same budget as invalid ones -- the
  // limiter runs before authentication logic, so success/failure of the
  // credential check itself is irrelevant to whether the slot is consumed.
  // -------------------------------------------------------------------
  attemptNumber++;
  if (hasGenericCreds) {
    attempt(attemptNumber, "valid", config.credentials.generic.email, config.credentials.generic.password);
  } else {
    attempt(attemptNumber, "invalid", INVALID_EMAIL, INVALID_PASSWORD);
  }

  // -------------------------------------------------------------------
  // Attempts 7-10: invalid credentials again, filling the budget to
  // exactly TIER.max (10) total requests in this window.
  // -------------------------------------------------------------------
  while (attemptNumber < TIER.max) {
    attemptNumber++;
    attempt(attemptNumber, "invalid", INVALID_EMAIL, INVALID_PASSWORD);
  }

  logInfo("auth", `Budget of ${TIER.max} requests exhausted. The next request should be rejected with 429.`);

  // -------------------------------------------------------------------
  // Attempt 11 (and 12, to confirm it isn't a one-off fluke): must be 429
  // with a valid Retry-After header, regardless of credential validity.
  // -------------------------------------------------------------------
  attemptNumber++;
  const eleventh = attempt(attemptNumber, "429", INVALID_EMAIL, INVALID_PASSWORD);
  const retryAfter = eleventh.headers["Retry-After"];

  attemptNumber++;
  attempt(attemptNumber, "429", config.credentials.generic.email || INVALID_EMAIL, config.credentials.generic.password || INVALID_PASSWORD);

  logInfo(
    "auth",
    `Test complete. Retry-After on the 11th request was ${retryAfter}s -- wait at least that long (or the full ${TIER.windowSec}s window) before re-running this script against the same IP.`
  );
}

export function handleSummary(data) {
  return standardSummary(data, "AUTH RATE LIMIT TEST SUMMARY (10 req / 15min, IP-keyed)", "auth-rate-limit-summary.json");
}

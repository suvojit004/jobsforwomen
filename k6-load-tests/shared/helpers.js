/**
 * shared/helpers.js
 * ---------------------------------------------------------------------------
 * Reusable helpers shared by every script in the suite: authentication
 * (login, JWT caching + auto-refresh), request wrappers, rate-limit-header
 * checks, structured logging, and a plain-text/JSON summary formatter.
 *
 * Notes on k6's execution model that shaped this file:
 *  - k6 re-evaluates each imported module once per VU. A `let` at module
 *    scope is therefore a safe *per-VU* cache (not shared across VUs) --
 *    exactly what we want for "one JWT per virtual user".
 *  - http.* calls block synchronously; k6 has no async/await runtime, so all
 *    functions below are plain synchronous functions.
 * ---------------------------------------------------------------------------
 */
import http from "k6/http";
import { check, fail, sleep } from "k6";
import encoding from "k6/encoding";
import { config } from "./config.js";

// Per-VU token cache: { [cacheKey]: { accessToken, decoded, fetchedAtSec } }
const tokenCache = {};

// -----------------------------------------------------------------------
// URL building
// -----------------------------------------------------------------------
export function apiUrl(path) {
  return `${config.baseUrl}${config.apiPrefix}${path}`;
}

export function rootUrl(path) {
  return `${config.baseUrl}${path}`;
}

// -----------------------------------------------------------------------
// Logging -- prefixed, timestamped, consistent across all scripts
// -----------------------------------------------------------------------
function ts() {
  return new Date().toISOString();
}

export function logInfo(tag, message) {
  console.log(`[${ts()}] [INFO ] [${tag}] ${message}`);
}

export function logWarn(tag, message) {
  console.warn(`[${ts()}] [WARN ] [${tag}] ${message}`);
}

export function logError(tag, message) {
  console.error(`[${ts()}] [ERROR] [${tag}] ${message}`);
}

// -----------------------------------------------------------------------
// JWT helpers
// -----------------------------------------------------------------------
/**
 * Decodes a JWT payload without verifying the signature (we don't have the
 * secret, and don't need to -- we only want the `exp` claim to know when to
 * proactively refresh).
 */
export function decodeJwtPayload(token) {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    // base64url -> base64
    const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
    const decoded = encoding.b64decode(padded, "std", "s");
    return JSON.parse(decoded);
  } catch (e) {
    return null;
  }
}

// -----------------------------------------------------------------------
// Global-tier budget guard
// -----------------------------------------------------------------------
// EVERY request -- regardless of tier -- passes through the GLOBAL limiter
// first (app.use(rateLimitMiddleware) in app.ts runs before any router is
// mounted). The global tier's default ceiling (100 req/60s, IP-keyed) is
// LOWER than several of the per-role tiers this suite needs to walk all the
// way to their own boundary (candidate/recruiter: 150, admin: 200, search:
// 300). Without pacing, a script trying to prove "the candidate tier allows
// 150 requests" would instead get rejected by the *global* tier around
// request #100 -- a correct rejection, but from the wrong limiter, which
// would make the candidate-tier assertions fail for the wrong reason.
//
// This guard is a best-effort, per-VU, client-side approximation of the
// server's global counter: it tracks requests sent through the paced
// wrappers (authGet/authPost/login below) and proactively sleeps for a
// fresh window once it's within `safetyMargin` of the global ceiling. It
// can't see requests from other concurrent processes sharing the same
// egress IP -- if you're running scripts in parallel against the same
// target, expect some cross-talk on the global bucket regardless.
let globalBudgetState = { count: 0, windowStartMs: Date.now() };
const GLOBAL_GUARD_SAFETY_MARGIN = 5;

function guardGlobalBudget() {
  const g = config.rateLimits.global;
  const nowMs = Date.now();

  if (nowMs - globalBudgetState.windowStartMs > g.windowSec * 1000) {
    globalBudgetState = { count: 0, windowStartMs: nowMs };
  }

  if (globalBudgetState.count >= g.max - GLOBAL_GUARD_SAFETY_MARGIN) {
    const elapsedMs = nowMs - globalBudgetState.windowStartMs;
    const waitMs = Math.max(0, g.windowSec * 1000 - elapsedMs) + 1000;
    logInfo(
      "global-guard",
      `Approaching the shared global limit (${g.max} req/${g.windowSec}s) after ${globalBudgetState.count} requests this window -- pausing ${Math.ceil(waitMs / 1000)}s so this script's own tier boundary can be reached without a premature 429 from the global tier.`
    );
    sleep(waitMs / 1000);
    globalBudgetState = { count: 0, windowStartMs: Date.now() };
  }

  globalBudgetState.count++;
}

// -----------------------------------------------------------------------
// Authentication
// -----------------------------------------------------------------------
/**
 * Performs a raw login call. Does NOT cache -- use getAuthToken() for the
 * cached/auto-refreshed version. Returns the raw k6 http response so callers
 * (e.g. auth-rate-limit.js) can inspect status/headers directly.
 */
export function login(email, password) {
  guardGlobalBudget();
  const payload = JSON.stringify({ email, password });
  const params = {
    headers: { "Content-Type": "application/json" },
    tags: { name: "auth_login" },
    timeout: config.requestTimeout,
  };
  return http.post(apiUrl(config.endpoints.auth.loginPath), payload, params);
}

/**
 * Returns a valid access token for the given credential pair, logging in on
 * first use and transparently re-logging in when the cached token is
 * missing/near expiry. `cacheKey` lets a script keep multiple independent
 * sessions alive in parallel (e.g. two candidate accounts for an isolation
 * test) even though the underlying credentials might collide.
 */
export function getAuthToken(email, password, cacheKey = email) {
  if (!email || !password) {
    fail(
      `[auth] Missing credentials for cacheKey="${cacheKey}". Set the matching -e EMAIL/PASSWORD (or role-specific) environment variables.`
    );
  }

  const cached = tokenCache[cacheKey];
  const nowSec = Date.now() / 1000;

  if (cached && cached.decoded && cached.decoded.exp) {
    const secondsRemaining = cached.decoded.exp - nowSec;
    if (secondsRemaining > config.tokenRefreshSkewSec) {
      return cached.accessToken;
    }
    logInfo("auth", `Cached token for "${cacheKey}" is expiring soon (${Math.round(secondsRemaining)}s left) -- re-authenticating.`);
  }

  const res = login(email, password);
  if (res.status !== 200) {
    fail(
      `[auth] Login failed for "${cacheKey}" (status=${res.status}). Response: ${res.body ? res.body.substring(0, 300) : "<empty>"}`
    );
  }

  let body;
  try {
    body = JSON.parse(res.body);
  } catch (e) {
    fail(`[auth] Login response for "${cacheKey}" was not valid JSON.`);
  }

  const accessToken = body && body.data && body.data.accessToken;
  if (!accessToken) {
    fail(`[auth] Login response for "${cacheKey}" did not contain data.accessToken.`);
  }

  const decoded = decodeJwtPayload(accessToken);
  tokenCache[cacheKey] = { accessToken, decoded, fetchedAtSec: nowSec };
  logInfo("auth", `Authenticated "${cacheKey}" (userId=${decoded ? decoded.userId : "unknown"}).`);
  return accessToken;
}

export function authHeaders(token, extra = {}) {
  return Object.assign(
    {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    extra
  );
}

// -----------------------------------------------------------------------
// Request wrappers -- thin, but keep call sites in the test scripts short
// and give every request a stable `tags.name` for per-endpoint metrics.
// -----------------------------------------------------------------------
export function authGet(path, token, tagName, params = {}) {
  guardGlobalBudget();
  return http.get(apiUrl(path), {
    headers: authHeaders(token),
    tags: { name: tagName || path },
    timeout: config.requestTimeout,
    ...params,
  });
}

export function authPost(path, token, body, tagName, params = {}) {
  guardGlobalBudget();
  return http.post(apiUrl(path), JSON.stringify(body || {}), {
    headers: authHeaders(token),
    tags: { name: tagName || path },
    timeout: config.requestTimeout,
    ...params,
  });
}

/**
 * GET for public (unauthenticated) endpoints. `fullUrl` must already be a
 * complete URL -- build it with apiUrl() or rootUrl() at the call site so
 * it's obvious at a glance whether the path sits under /api/v1 or the root.
 */
export function publicGet(fullUrl, tagName, params = {}) {
  return http.get(fullUrl, {
    tags: { name: tagName || fullUrl },
    timeout: config.requestTimeout,
    ...params,
  });
}

// -----------------------------------------------------------------------
// Rate-limit header / behavior checks
// -----------------------------------------------------------------------
/**
 * Verifies the three standard rate-limit headers are present and
 * well-formed. Returns the parsed numeric values (or null if a header was
 * missing) so callers can assert on trends (e.g. remaining decreasing), PLUS
 * an `ok` boolean (k6's check() return value: true only if every sub-check
 * passed) so callers can tell -- and log -- whether this actually succeeded
 * instead of just assuming it did.
 *
 * IMPORTANT: only call this against a response that's expected to carry
 * these headers. Confirmed from rateLimit.middleware.ts: `applyHeaders()`
 * (which sets X-RateLimit-Limit/Remaining/Reset) only runs on the SUCCESS
 * path. The `reject()` path (429) returns before it, and only sets
 * Retry-After. Calling this on a 429 response will make every "header
 * present" check fail, every time, by design -- that's not a bug in this
 * function, it's a bug in whoever calls it on a 429 (see checkRetryAfter()
 * below for the correct thing to call there instead, and stress-test.js's
 * history for a concrete example of this call-site mistake).
 */
export function checkRateLimitHeaders(res, tag, expectedLimit) {
  const limitHeader = res.headers["X-Ratelimit-Limit"] ?? res.headers["X-RateLimit-Limit"];
  const remainingHeader = res.headers["X-Ratelimit-Remaining"] ?? res.headers["X-RateLimit-Remaining"];
  const resetHeader = res.headers["X-Ratelimit-Reset"] ?? res.headers["X-RateLimit-Reset"];

  const limit = limitHeader !== undefined ? Number(limitHeader) : null;
  const remaining = remainingHeader !== undefined ? Number(remainingHeader) : null;
  const reset = resetHeader !== undefined ? Number(resetHeader) : null;

  const ok = check(res, {
    [`${tag}: X-RateLimit-Limit header present`]: () => limitHeader !== undefined,
    [`${tag}: X-RateLimit-Remaining header present`]: () => remainingHeader !== undefined,
    [`${tag}: X-RateLimit-Reset header present`]: () => resetHeader !== undefined,
    [`${tag}: X-RateLimit-Remaining is a non-negative number`]: () => remaining === null || (Number.isFinite(remaining) && remaining >= 0),
    [`${tag}: X-RateLimit-Reset is a plausible unix timestamp`]: () => reset === null || reset > Date.now() / 1000 - 5,
    ...(expectedLimit
      ? { [`${tag}: X-RateLimit-Limit equals expected tier max (${expectedLimit})`]: () => limit === expectedLimit }
      : {}),
  });

  if (!ok) {
    logError(
      "checkRateLimitHeaders",
      `${tag}: FAILED -- status=${res.status}, X-RateLimit-Limit="${limitHeader}", X-RateLimit-Remaining="${remainingHeader}", X-RateLimit-Reset="${resetHeader}".`
    );
  }

  return { limit, remaining, reset, ok };
}

/**
 * Verifies a 429 response carries a well-formed Retry-After header and a
 * JSON error body (the backend's sendError() shape). Deliberately does NOT
 * assert X-RateLimit-Limit/Remaining/Reset here -- see checkRateLimitHeaders'
 * doc comment above for why a 429 from this backend never carries them.
 *
 * Two things this version does that the original didn't:
 *
 * 1. Separates a TRANSPORT-level failure from a genuine assertion mismatch.
 *    k6 represents a request that never got a real HTTP response (timeout,
 *    connection reset, DNS failure, an intermediary proxy/CDN/WAF dropping
 *    the connection) as `res.status === 0` with `res.error` populated --
 *    NOT as an absence of a response. Previously, a transport failure and a
 *    real-but-wrong response were indistinguishable: both made every check
 *    in this function fail identically, which reads exactly like "the rate
 *    limiter is broken" when the real story might be "this specific
 *    request never reached the app." Render (or any intermediary in front
 *    of it) is more likely to do this to a tight burst of many rapid
 *    sequential requests than to isolated ones -- which is exactly the
 *    traffic shape a boundary-walk test produces right at the 429 cutover.
 * 2. Logs full diagnostics (status/headers/body) whenever the checks don't
 *    all pass, so a failing run is self-explaining instead of requiring a
 *    second run with manual debugging to find out what the server actually
 *    sent.
 *
 * Returns { retryAfter, ok } -- `ok` mirrors checkRateLimitHeaders' pattern
 * so callers can react to (and log) the real outcome.
 */
export function checkRetryAfter(res, tag) {
  const isTransportFailure = res.status === 0 || Boolean(res.error);
  if (isTransportFailure) {
    logError(
      "checkRetryAfter",
      `${tag}: TRANSPORT FAILURE, not a rate-limiter assertion mismatch -- status=${res.status}, error="${res.error}", error_code=${res.error_code}. This request never received a real HTTP response (timeout / connection reset / DNS / an intermediary dropping it). Investigate network conditions or a proxy/CDN/WAF in front of the backend before concluding the rate limiter itself is wrong.`
    );
    const ok = check(res, {
      [`${tag}: received a real HTTP response (no transport-level failure)`]: () => false,
    });
    return { retryAfter: null, ok };
  }

  const retryAfterHeader = res.headers["Retry-After"];
  const retryAfter = retryAfterHeader !== undefined ? Number(retryAfterHeader) : null;

  const ok = check(res, {
    [`${tag}: status is 429`]: () => res.status === 429,
    [`${tag}: Retry-After header present`]: () => retryAfterHeader !== undefined,
    [`${tag}: Retry-After is a positive integer (seconds)`]: () => retryAfter !== null && Number.isFinite(retryAfter) && retryAfter > 0,
    [`${tag}: body indicates failure (success:false)`]: () => {
      try {
        return JSON.parse(res.body).success === false;
      } catch (e) {
        return false;
      }
    },
  });

  if (!ok) {
    logError(
      "checkRetryAfter",
      `${tag}: FAILED -- status=${res.status} (want 429), Retry-After="${retryAfterHeader}", body="${res.body ? res.body.substring(0, 200) : "<empty>"}".`
    );
  }

  return { retryAfter, ok };
}

export function checkStatus(res, expectedStatuses, tag) {
  const expected = Array.isArray(expectedStatuses) ? expectedStatuses : [expectedStatuses];
  const ok = check(res, {
    [`${tag}: status is one of [${expected.join(", ")}] (got ${res.status})`]: () => expected.includes(res.status),
  });
  if (!ok) {
    logError("checkStatus", `${tag}: FAILED -- got status ${res.status}, expected one of [${expected.join(", ")}].`);
  }
  return ok;
}

export function checkResponseTime(res, maxMs, tag) {
  return check(res, {
    [`${tag}: response time < ${maxMs}ms (got ${Math.round(res.timings.duration)}ms)`]: () => res.timings.duration < maxMs,
  });
}

/**
 * Convenience bundle: status + rate-limit headers + response time in one
 * call, used by almost every "functional" check in the suite. Returns a
 * single `ok` boolean (true only if ALL THREE passed) so callers can track
 * real pass/fail instead of assuming success and printing an unconditional
 * "complete" log regardless of what actually happened (see
 * global-rate-limit.js and runTierBoundaryTest below for why that mattered).
 */
export function checkStandard(res, tag, { expectedStatuses = [200], expectedLimit = null, maxMs = 5000 } = {}) {
  const statusOk = checkStatus(res, expectedStatuses, tag);
  const headers = checkRateLimitHeaders(res, tag, expectedLimit);
  const timeOk = checkResponseTime(res, maxMs, tag);
  return statusOk && headers.ok && timeOk;
}

/**
 * For load tests run at a concurrency level EXPECTED to exceed a tier's
 * budget on purpose (e.g. workflow-load-test.js's at-scale scenario, where
 * hundreds of VUs deliberately share a handful of real accounts) -- treats
 * both a success status and 429 as valid, correctly-behaving outcomes. A
 * 429 under heavy shared-account load is the rate limiter doing exactly
 * its job, not a bug, so it shouldn't be indistinguishable from a real
 * failure in the check results. Still strictly validates whichever shape
 * actually came back (full header set on success, Retry-After on 429);
 * anything outside `successStatuses`/429 is always a genuine failure.
 */
export function checkRateAware(res, tag, expectedLimit, successStatuses = [200]) {
  if (successStatuses.includes(res.status)) {
    const { ok } = checkRateLimitHeaders(res, `${tag} (${res.status})`, expectedLimit);
    return { status: res.status, ok };
  }
  if (res.status === 429) {
    const { ok } = checkRetryAfter(res, `${tag} (429)`);
    return { status: 429, ok };
  }
  const ok = checkStatus(res, [...successStatuses, 429], tag);
  return { status: res.status, ok };
}

// -----------------------------------------------------------------------
// Misc
// -----------------------------------------------------------------------
export function sleepJitter(baseSeconds) {
  // Small random jitter to avoid every VU firing in perfect lockstep, which
  // would be unrealistic and could accidentally synchronize on window
  // boundaries in the fixed-window limiter.
  return baseSeconds + Math.random() * (baseSeconds * 0.2);
}

export function currentUserId(token) {
  const decoded = decodeJwtPayload(token);
  return decoded ? decoded.userId : "unknown";
}

/**
 * Fires one unchecked, generously-timed request to /health to wake a
 * spun-down Render free-tier dyno before the timed/asserted part of a
 * script begins. Render can take 30-60s to cold-start an idle instance --
 * without this, the very first real request in a script would eat that
 * latency and could spuriously fail a response-time check. Failures here
 * are logged but never fail the test; this call's only job is to absorb
 * the cold start.
 */
export function warmUp() {
  logInfo("warmup", "Sending a warm-up request to /health (absorbs Render cold-start latency, not asserted)...");
  const start = Date.now();
  const res = http.get(rootUrl(config.endpoints.health), {
    tags: { name: "warmup_health" },
    timeout: "90s",
  });
  const elapsed = Date.now() - start;
  logInfo("warmup", `Warm-up complete in ${elapsed}ms (status=${res.status}).${elapsed > 5000 ? " Dyno appears to have cold-started." : ""}`);
}

// -----------------------------------------------------------------------
// Reusable tier-boundary test runner
// -----------------------------------------------------------------------
/**
 * Drives a request loop against a single user-keyed or IP-keyed endpoint
 * until it crosses the tier's `max`, asserting the boundary precisely:
 * every request up to and including `max` (minus whatever was already
 * consumed elsewhere in the run) must succeed, and every request past it
 * must be a 429 with Retry-After. Shared by candidate/recruiter/admin/
 * search scripts so the boundary-walking logic (and its edge cases) is
 * written, tested, and fixed exactly once.
 *
 * @param {object} opts
 * @param {string} opts.tierName - label used in log lines/check names
 * @param {{max:number, windowSec:number}} opts.tier
 * @param {function(): object} opts.makeRequest - () => k6 http Response
 * @param {number} [opts.alreadyConsumed] - requests already spent against
 *   this same bucket earlier in the run (e.g. by functional checks)
 * @param {number} [opts.overshoot] - extra requests to send past the
 *   boundary to confirm rejection isn't a one-off
 * @returns {{lastReset: number|null, requestsSent: number, failureCount: number}}
 */
export function runTierBoundaryTest({ tierName, tier, makeRequest, alreadyConsumed = 0, overshoot = 5 }) {
  const remainingToBoundary = Math.max(0, tier.max - alreadyConsumed);
  const totalToSend = remainingToBoundary + overshoot;
  let lastReset = null;
  let failureCount = 0;

  logInfo(tierName, `Walking tier boundary: ${alreadyConsumed} already consumed, sending ${totalToSend} more (limit=${tier.max}).`);

  for (let i = 1; i <= totalToSend; i++) {
    const requestNumber = alreadyConsumed + i;
    const res = makeRequest();

    if (requestNumber <= tier.max) {
      const ok = checkStandard(res, `${tierName} request #${requestNumber} (<= ${tier.max}, should succeed)`, {
        expectedStatuses: [200],
        expectedLimit: tier.max,
      });
      if (!ok) failureCount++;
      // Track the reset timestamp from the last SUCCESSFUL response -- a
      // 429 from this backend never carries X-RateLimit-Reset (see
      // checkRateLimitHeaders' doc comment), so reading it off the
      // rejected branch, as an earlier version of this function did, would
      // silently and permanently leave `lastReset` at null.
      const resetHeader = res.headers["X-Ratelimit-Reset"] ?? res.headers["X-RateLimit-Reset"];
      if (resetHeader !== undefined) lastReset = Number(resetHeader);
    } else {
      const { ok } = checkRetryAfter(res, `${tierName} request #${requestNumber} (> ${tier.max}, should be rejected)`);
      if (!ok) failureCount++;
    }
  }

  if (failureCount === 0) {
    logInfo(tierName, `Boundary walk complete: request #${tier.max} succeeded, requests beyond it were rejected with 429 -- all assertions passed.`);
  } else {
    logWarn(
      tierName,
      `Boundary walk finished with ${failureCount} FAILED assertion(s) out of ${totalToSend} requests -- see the [ERROR] lines above for exactly which request and which specific check failed. Do not treat this run as a pass.`
    );
  }
  return { lastReset, requestsSent: totalToSend, failureCount };
}

// -----------------------------------------------------------------------
// Summary formatting -- used by every script's handleSummary() export.
// Intentionally dependency-free (no jslib.k6.io fetch) so scripts work in
// network-restricted CI runners too.
// -----------------------------------------------------------------------
function pad(str, len) {
  str = String(str);
  return str.length >= len ? str : str + " ".repeat(len - str.length);
}

export function renderTextSummary(data, title) {
  const lines = [];
  const divider = "=".repeat(78);
  lines.push(divider);
  lines.push(`  ${title}`);
  lines.push(divider);

  const metrics = data.metrics || {};

  const fmtMs = (v) => (v === undefined ? "n/a" : `${v.toFixed(2)}ms`);
  const fmtCount = (v) => (v === undefined ? "n/a" : String(v));
  const fmtRate = (v) => (v === undefined ? "n/a" : `${(v * 100).toFixed(2)}%`);

  if (metrics.http_reqs) {
    lines.push(`  Total HTTP requests   : ${fmtCount(metrics.http_reqs.values.count)}`);
  }
  if (metrics.http_req_failed) {
    lines.push(`  Failed request rate   : ${fmtRate(metrics.http_req_failed.values.rate)}`);
  }
  if (metrics.http_req_duration) {
    const d = metrics.http_req_duration.values;
    lines.push(`  Request duration      : avg=${fmtMs(d.avg)} p95=${fmtMs(d["p(95)"])} max=${fmtMs(d.max)}`);
  }
  if (metrics.checks) {
    lines.push(`  Checks passed         : ${fmtRate(metrics.checks.values.rate)} (${fmtCount(metrics.checks.values.passes)} passed / ${fmtCount(metrics.checks.values.fails)} failed)`);
  }

  lines.push("-".repeat(78));
  lines.push("  Custom metrics:");
  for (const [name, metric] of Object.entries(metrics)) {
    if (["http_reqs", "http_req_failed", "http_req_duration", "checks", "iterations", "iteration_duration", "vus", "vus_max", "data_received", "data_sent"].includes(name)) {
      continue;
    }
    const v = metric.values;
    const summary = v.rate !== undefined ? fmtRate(v.rate) : v.count !== undefined ? fmtCount(v.count) : v.value !== undefined ? fmtCount(v.value) : JSON.stringify(v);
    lines.push(`    ${pad(name, 32)}: ${summary}`);
  }

  lines.push(divider);
  return lines.join("\n") + "\n";
}

/**
 * Standard handleSummary() implementation every script re-exports. Prints a
 * human-readable summary to stdout and writes the full raw JSON metrics
 * next to the script for CI archiving / deeper analysis.
 */
export function standardSummary(data, title, jsonFileName) {
  const out = {
    stdout: renderTextSummary(data, title),
  };
  out[jsonFileName] = JSON.stringify(data, null, 2);
  return out;
}

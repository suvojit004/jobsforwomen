/**
 * shared/config.js
 * ---------------------------------------------------------------------------
 * Central configuration for the JobsForWomen k6 rate-limit test suite.
 *
 * Nothing in here should need to change between environments -- everything
 * environment-specific (URL, credentials) is read from k6 environment
 * variables (`-e KEY=value` on the CLI). Endpoint paths and default rate
 * limit tiers are read directly from the backend source
 * (backend/src/shared/middleware/rateLimit.middleware.ts,
 * backend/src/shared/config/env.ts, and each module's *.routes.ts) so the
 * tests exercise real routes rather than guessed ones.
 * ---------------------------------------------------------------------------
 */

// -----------------------------------------------------------------------
// Base URL & API prefix
// -----------------------------------------------------------------------
// Render free-tier instances spin down when idle -- the first request after
// a period of inactivity can take 30-60s to "wake" the dyno. Scripts should
// tolerate a slow first request rather than treating it as a failure.
const RAW_BASE_URL = __ENV.BASE_URL || "https://jobsforwomen-266w.onrender.com";

// -----------------------------------------------------------------------
// Account pools -- for load tests that need many VUs to act as "many
// logged-in users" without provisioning one real account per VU. Format:
// `-e CANDIDATE_POOL="a@test.com:pass1,b@test.com:pass2,c@test.com:pass3"`
// Falls back to a single-account "pool" built from CANDIDATE_EMAIL/PASSWORD
// (or RECRUITER_EMAIL/PASSWORD) if the *_POOL var isn't set, so existing
// scripts and env-var setups keep working unchanged.
//
// Reusing a handful of real accounts across hundreds of VUs is realistic
// for "many browser tabs, few real humans" traffic, but it means many VUs
// share the SAME userId -- and therefore the SAME candidate/recruiter
// rate-limit bucket (150 req/60s, userId-keyed). At high concurrency you
// WILL see 429s from your own rate limiter well before every VU gets a
// turn. That's expected and worth measuring, not a bug in the pool.
function parsePool(poolEnvVar, fallbackEmail, fallbackPassword) {
  const raw = __ENV[poolEnvVar];
  if (raw && raw.trim().length > 0) {
    return raw
      .split(",")
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0)
      .map((entry) => {
        const idx = entry.indexOf(":");
        if (idx === -1) {
          throw new Error(`${poolEnvVar} entry "${entry}" is malformed -- expected "email:password".`);
        }
        return { email: entry.slice(0, idx), password: entry.slice(idx + 1) };
      });
  }
  if (fallbackEmail && fallbackPassword) {
    return [{ email: fallbackEmail, password: fallbackPassword }];
  }
  return [];
}

export const config = {
  // Strip any trailing slash so `${baseUrl}${path}` never double-slashes.
  baseUrl: RAW_BASE_URL.replace(/\/+$/, ""),

  // Every route except /health is mounted under this prefix in app.ts.
  apiPrefix: "/api/v1",

  // -----------------------------------------------------------------------
  // Credentials (all optional -- individual scripts validate what they need
  // and skip/fail fast with a clear message if a required pair is missing)
  // -----------------------------------------------------------------------
  credentials: {
    // Generic pair -- used as a stand-in "second account" for user-isolation
    // checks when a role-specific secondary account isn't provided.
    generic: {
      email: __ENV.EMAIL,
      password: __ENV.PASSWORD,
    },
    admin: {
      email: __ENV.ADMIN_EMAIL,
      password: __ENV.ADMIN_PASSWORD,
    },
    recruiter: {
      email: __ENV.RECRUITER_EMAIL,
      password: __ENV.RECRUITER_PASSWORD,
    },
    candidate: {
      email: __ENV.CANDIDATE_EMAIL,
      password: __ENV.CANDIDATE_PASSWORD,
    },
    // Small pools of accounts for workflow-load-test.js's at-scale scenario
    // -- see parsePool()'s doc comment above for the -e format and the
    // shared-bucket tradeoff.
    candidatePool: parsePool("CANDIDATE_POOL", __ENV.CANDIDATE_EMAIL, __ENV.CANDIDATE_PASSWORD),
    recruiterPool: parsePool("RECRUITER_POOL", __ENV.RECRUITER_EMAIL, __ENV.RECRUITER_PASSWORD),
  },

  // -----------------------------------------------------------------------
  // Endpoint paths (relative to apiPrefix, except `health` which is mounted
  // at the app root -- see backend/src/app.ts)
  // -----------------------------------------------------------------------
  endpoints: {
    health: "/health", // NOT under /api/v1 -- app.get("/health", ...)

    auth: {
      loginPath: "/auth/login",
      registerCandidate: "/auth/register/candidate",
      registerRecruiter: "/auth/register/recruiter",
      refresh: "/auth/refresh",
      forgotPassword: "/auth/forgot-password",
      resetPassword: "/auth/reset-password",
      verifyEmail: "/auth/verify-email", // GET, ?token=
      oauth: "/auth/oauth",
      acceptInvitation: "/auth/invitations/accept",
      me: "/auth/me",
    },

    // All candidate.* routes require authenticateToken (see
    // candidate.routes.ts) and sit behind candidateRateLimiter EXCEPT
    // /jobs* which is explicitly re-tiered to searchRateLimiter.
    candidate: {
      dashboard: "/candidates/dashboard",
      analytics: "/candidates/analytics",
      profile: "/candidates/profile",
      resume: "/candidates/resume", // uploadRateLimiter layered on top
      savedJobs: "/candidates/saved-jobs",
      settings: "/candidates/settings",
      notifications: "/candidates/notifications",
      jobs: "/candidates/jobs", // searchRateLimiter, not candidateRateLimiter
      applications: "/candidates/applications",
      conversations: "/candidates/conversations",
      // Dynamic sub-paths (jobId/applicationId/conversationId are runtime
      // values) -- build these with the helpers below rather than
      // string-concatenating in every call site.
    },

    // All recruiter.* routes require authenticateToken and sit behind
    // recruiterRateLimiter EXCEPT the upload sub-routes (logo/gallery/perk
    // docs/offer letters), which layer uploadRateLimiter on top.
    recruiter: {
      dashboard: "/recruiters/dashboard",
      analytics: "/recruiters/analytics",
      settings: "/recruiters/settings",
      notifications: "/recruiters/notifications",
      jobs: "/recruiters/jobs",
      companyLogo: "/recruiters/company/logo", // uploadRateLimiter
    },

    // Mounted at /api/v1/admins (plural) in app.ts -- note this differs from
    // the singular `/admin` shown in docs/08_API_REFERENCE.md; the mount
    // point in app.ts is the source of truth. Requires an ADMIN_TIER_ROLES
    // member (Admin / Super Admin / Moderator / Support Executive).
    admin: {
      dashboard: "/admins/dashboard",
      health: "/admins/health",
      search: "/admins/search", // still adminRateLimiter, NOT searchRateLimiter
      reports: "/admins/reports",
      companies: "/admins/companies",
      jobs: "/admins/jobs",
      users: "/admins/users",
      settings: "/admins/settings",
      notifications: "/admins/notifications",
    },
  },

  // -----------------------------------------------------------------------
  // Rate limit tiers -- mirrors backend/src/shared/config/env.ts defaults.
  // Overridable via -e RL_<TIER>_MAX / RL_<TIER>_WINDOW_SEC in case the
  // target environment has been configured with non-default values.
  // -----------------------------------------------------------------------
  rateLimits: {
    global: {
      max: Number(__ENV.RL_GLOBAL_MAX) || 100,
      windowSec: Number(__ENV.RL_GLOBAL_WINDOW_SEC) || 60,
      keyedBy: "ip",
    },
    auth: {
      max: Number(__ENV.RL_AUTH_MAX) || 10,
      windowSec: Number(__ENV.RL_AUTH_WINDOW_SEC) || 15 * 60,
      keyedBy: "ip",
    },
    admin: {
      max: Number(__ENV.RL_ADMIN_MAX) || 200,
      windowSec: Number(__ENV.RL_ADMIN_WINDOW_SEC) || 60,
      keyedBy: "userId",
    },
    recruiter: {
      max: Number(__ENV.RL_RECRUITER_MAX) || 150,
      windowSec: Number(__ENV.RL_RECRUITER_WINDOW_SEC) || 60,
      keyedBy: "userId",
    },
    candidate: {
      max: Number(__ENV.RL_CANDIDATE_MAX) || 150,
      windowSec: Number(__ENV.RL_CANDIDATE_WINDOW_SEC) || 60,
      keyedBy: "userId",
    },
    upload: {
      max: Number(__ENV.RL_UPLOAD_MAX) || 10,
      windowSec: Number(__ENV.RL_UPLOAD_WINDOW_SEC) || 10 * 60,
      keyedBy: "userId",
    },
    search: {
      max: Number(__ENV.RL_SEARCH_MAX) || 300,
      windowSec: Number(__ENV.RL_SEARCH_WINDOW_SEC) || 60,
      keyedBy: "ip",
    },
  },

  // -----------------------------------------------------------------------
  // Misc
  // -----------------------------------------------------------------------
  // Generous default -- Render free-tier cold starts (see the note above)
  // can take 30-60s for the very first request after idle. A short timeout
  // here would surface as a confusing network-level error rather than the
  // slow-but-successful response it actually is.
  requestTimeout: __ENV.REQUEST_TIMEOUT || "60s",
  // Access tokens are minted with a 15m expiry (JWT_ACCESS_EXPIRY) -- refresh
  // proactively a bit before that to avoid a mid-scenario 401.
  tokenRefreshSkewSec: 60,
};

export default config;

/**
 * upload-rate-limit.js
 * ---------------------------------------------------------------------------
 * Verifies the UPLOAD rate limit tier: 10 uploads / 10 minutes, keyed by
 * authenticated User ID (backend's `uploadRateLimiter`, layered on top of
 * the candidate/recruiter tier for POST /candidates/resume,
 * /recruiters/company/logo, /recruiters/company/gallery,
 * /recruiters/perks/:id/documents, /recruiters/applications/:id/offer).
 *
 * This script targets POST /api/v1/candidates/resume specifically, using a
 * real multipart/form-data upload of a small, valid PDF fixture
 * (shared/fixtures/sample-resume.pdf) -- multer's fileFilter in
 * upload.middleware.ts rejects non-PDF/DOC/DOCX uploads outright, and a
 * malformed body would never reach the rate limiter's boundary logic at
 * all, so a real, valid file is required to test this meaningfully. The
 * upload field name is "resume" (uploader.single("resume")), NOT "file" as
 * a quick read of the API reference doc might suggest.
 *
 * *** IMPORTANT -- THIS TEST HAS SIDE EFFECTS ***
 * Every successful call genuinely overwrites CANDIDATE_EMAIL's resume and
 * may enqueue downstream work (virus scan, notifications) via BullMQ. Run
 * this ONLY against a disposable/test candidate account, never a real
 * production user. Because the budget is 10 requests per 10 minutes, this
 * script also can't be usefully re-run against the same account more than
 * once per 10-minute window.
 *
 * Run:
 *   k6 run upload-rate-limit.js \
 *     -e BASE_URL=https://jobsforwomen-266w.onrender.com \
 *     -e CANDIDATE_EMAIL=disposable-candidate@test.com -e CANDIDATE_PASSWORD=pass123
 * ---------------------------------------------------------------------------
 */
import http from "k6/http";
import { config } from "./shared/config.js";
import { apiUrl, getAuthToken, checkStandard, checkRetryAfter, logInfo, logWarn, standardSummary, warmUp } from "./shared/helpers.js";

const TIER = config.rateLimits.upload; // { max: 10, windowSec: 600, keyedBy: 'userId' }

// Loaded once at init time (k6 requires open() to run in the init context,
// not inside a VU function) and reused for every upload attempt.
const resumeFileBytes = open("./shared/fixtures/sample-resume.pdf", "b");

export const options = {
  scenarios: {
    upload_tier_boundary: {
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

export function setup() {
  warmUp();
  const token = getAuthToken(config.credentials.candidate.email, config.credentials.candidate.password, "upload_candidate");
  return { token };
}

/**
 * Performs one multipart resume upload. Note: unlike JSON requests, we do
 * NOT set Content-Type manually -- k6 derives the correct
 * `multipart/form-data; boundary=...` value automatically when the body is
 * a plain object containing an http.file() value.
 */
function uploadResume(token, attemptNumber) {
  const body = {
    resume: http.file(resumeFileBytes, `k6-load-test-resume-${attemptNumber}.pdf`, "application/pdf"),
  };
  return http.post(apiUrl(config.endpoints.candidate.resume), body, {
    headers: { Authorization: `Bearer ${token}` },
    tags: { name: "candidate_resume_upload" },
    timeout: config.requestTimeout,
  });
}

export default function (data) {
  const { token } = data;
  logInfo("upload", `Testing upload tier: ${TIER.max} uploads / ${TIER.windowSec}s (${TIER.windowSec / 60}min), userId-keyed, via POST /candidates/resume.`);

  // -------------------------------------------------------------------
  // Uploads 1-10: expected to succeed.
  // -------------------------------------------------------------------
  let lastKnownReset = null; // only ever set from a SUCCESSFUL (200) response -- see note below
  let failureCount = 0;

  for (let i = 1; i <= TIER.max; i++) {
    const res = uploadResume(token, i);
    const ok = checkStandard(res, `upload attempt #${i} (<= ${TIER.max}, should succeed)`, {
      expectedStatuses: [200],
      expectedLimit: TIER.max,
      maxMs: 15000, // uploads are heavier than a plain GET; allow more time
    });
    if (!ok) failureCount++;

    const remaining = res.headers["X-Ratelimit-Remaining"] ?? res.headers["X-RateLimit-Remaining"];
    const resetHeader = res.headers["X-Ratelimit-Reset"] ?? res.headers["X-RateLimit-Reset"];
    if (resetHeader !== undefined) lastKnownReset = Number(resetHeader);
    logInfo("upload", `Upload #${i}: status=${res.status} X-RateLimit-Remaining=${remaining ?? "n/a"}`);
  }
  if (failureCount === 0) {
    logInfo("upload", `First ${TIER.max} uploads complete, all succeeded. The next upload should be rejected with 429.`);
  } else {
    logWarn("upload", `${failureCount} of the first ${TIER.max} uploads FAILED assertions -- see [ERROR] lines above. Continuing to the boundary check regardless.`);
  }

  // -------------------------------------------------------------------
  // Upload 11: must be rejected with 429 + Retry-After (up to windowSec).
  // -------------------------------------------------------------------
  const eleventh = uploadResume(token, TIER.max + 1);
  const { ok: eleventhOk } = checkRetryAfter(eleventh, `upload attempt #${TIER.max + 1} (> ${TIER.max}, should be rejected)`);
  if (!eleventhOk) failureCount++;
  // NOTE: do NOT read X-RateLimit-Reset off `eleventh` -- the backend's
  // reject() path never calls applyHeaders(), so a 429 here only ever
  // carries Retry-After. lastKnownReset is deliberately only ever updated
  // from the successful uploads above, which is the only place the
  // backend actually sends it.

  if (failureCount === 0) {
    logInfo(
      "upload",
      `Test complete, all assertions passed. Retry-After was ${eleventh.headers["Retry-After"]}s. Account is upload-rate-limited until ~${
        lastKnownReset ? new Date(lastKnownReset * 1000).toISOString() : `${TIER.windowSec}s from the first upload`
      }.`
    );
  } else {
    logWarn("upload", `Test finished with ${failureCount} FAILED assertion(s) total -- see [ERROR] lines above. Do not treat this run as a pass.`);
  }
}

export function handleSummary(data) {
  return standardSummary(data, "UPLOAD RATE LIMIT TEST SUMMARY (10 uploads / 10min, userId-keyed)", "upload-rate-limit-summary.json");
}

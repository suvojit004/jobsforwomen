# JobsForWomen -- k6 Rate Limit Test Suite

A k6 load-testing suite that verifies every rate-limit tier on the JobsForWomen backend (`https://jobsforwomen-266w.onrender.com`): global, authentication, candidate, recruiter, admin, upload, and search. Endpoint paths and default limits in this suite are taken directly from the backend source (`backend/src/shared/middleware/rateLimit.middleware.ts`, `backend/src/shared/config/env.ts`, and each module's `*.routes.ts`), not just the API docs, so they reflect what the server actually enforces.

## Contents

```
k6-load-tests/
├── shared/
│   ├── config.js       # base URL, credentials, endpoint paths, tier limits
│   ├── helpers.js       # auth/JWT caching, request wrappers, checks, logging, summaries
│   └── fixtures/
│       └── sample-resume.pdf   # tiny valid PDF used by upload-rate-limit.js
├── global-rate-limit.js
├── auth-rate-limit.js
├── candidate-rate-limit.js
├── recruiter-rate-limit.js
├── admin-rate-limit.js
├── upload-rate-limit.js
├── search-rate-limit.js
├── stress-test.js       # optional: Redis-backed counter correctness under concurrency
├── workflow-load-test.js # realistic login->browse->apply->message workflow at 100/500/1000 VUs
└── README.md
```

## 1. Installation

Install k6 itself (this is a standalone binary, not an npm package):

- **macOS**: `brew install k6`
- **Windows**: `choco install k6` or `winget install k6`
- **Linux (Debian/Ubuntu)**:
  ```bash
  sudo gpg -k
  sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6ACFD8
  echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
  sudo apt-get update && sudo apt-get install k6
  ```
- **Docker**: `docker pull grafana/k6`

Verify:
```bash
k6 version
```

No `npm install` is needed for this suite -- k6 resolves the `./shared/...` imports itself when you run a script, and the only "package" used (`k6/http`, `k6/encoding`, `k6/metrics`) ships inside the k6 binary.

## 2. Environment Variables

| Variable | Required by | Description |
|---|---|---|
| `BASE_URL` | all | Backend base URL. Defaults to `https://jobsforwomen-266w.onrender.com` if omitted. |
| `EMAIL` / `PASSWORD` | auth, candidate, recruiter (secondary account) | Generic account, used for the "valid login" step in the auth test and as the second account in isolation checks. |
| `CANDIDATE_EMAIL` / `CANDIDATE_PASSWORD` | candidate, search, upload | Primary Candidate-role account. |
| `RECRUITER_EMAIL` / `RECRUITER_PASSWORD` | recruiter | Recruiter-role account whose company should already be approved (some recruiter endpoints require `requireApprovedCompany`, though the ones this suite exercises -- dashboard/analytics/settings/notifications -- do not). |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | admin | Any account holding one of `Admin`, `Super Admin`, `Moderator`, or `Support Executive`. |
| `RL_<TIER>_MAX`, `RL_<TIER>_WINDOW_SEC` (optional) | all | Override the expected limit/window for a tier (`GLOBAL`, `AUTH`, `ADMIN`, `RECRUITER`, `CANDIDATE`, `UPLOAD`, `SEARCH`) if your target environment doesn't use the backend's defaults. |
| `STRESS_VUS`, `STRESS_DURATION` (optional) | stress-test | Concurrency and duration for the optional stress test. Default `30` VUs / `30s`. |
| `CANDIDATE_POOL` (preferred) | workflow-load-test | Comma-separated `email:password` pairs, e.g. `"a@test.com:pw1,b@test.com:pw2"`. Must contain **at most 10 accounts** (the auth tier's own budget -- see section 9). Falls back to a single-account pool built from `CANDIDATE_EMAIL`/`CANDIDATE_PASSWORD` if unset. |
| `PEAK_VUS` (optional) | workflow-load-test | Peak concurrent VUs for the `browse_at_scale` scenario. Default `100` -- pass `500` or `1000` for the larger runs. |
| `APPLY_VUS`, `HOLD_DURATION` (optional) | workflow-load-test | VU count for the small, real-mutation `apply_and_message` scenario (default `5`) and how long to hold at `PEAK_VUS` (default `1m`). |
| `REQUEST_TIMEOUT` (optional) | all | Per-request timeout. Defaults to `60s` to tolerate Render free-tier cold starts. |

**Use disposable/test accounts, not real users.** `upload-rate-limit.js` genuinely overwrites the candidate's resume; the boundary-walking tests in every script send well over 100 real requests per run.

## 3. Running Each Script

```bash
# Global tier (100 req/60s, IP-keyed)
k6 run global-rate-limit.js -e BASE_URL=https://jobsforwomen-266w.onrender.com

# Auth tier (10 req/15min, IP-keyed) -- budget is shared across login/register/
# refresh/forgot-password/etc, so don't re-run within 15 minutes of a prior run
k6 run auth-rate-limit.js \
  -e BASE_URL=https://jobsforwomen-266w.onrender.com \
  -e EMAIL=test@test.com -e PASSWORD=password123

# Candidate tier (150 req/60s, userId-keyed)
k6 run candidate-rate-limit.js \
  -e BASE_URL=https://jobsforwomen-266w.onrender.com \
  -e CANDIDATE_EMAIL=candidate@test.com -e CANDIDATE_PASSWORD=pass123 \
  -e EMAIL=candidate2@test.com -e PASSWORD=pass456   # optional, for the isolation check

# Recruiter tier (150 req/60s, userId-keyed)
k6 run recruiter-rate-limit.js \
  -e BASE_URL=https://jobsforwomen-266w.onrender.com \
  -e RECRUITER_EMAIL=recruiter@test.com -e RECRUITER_PASSWORD=pass123 \
  -e EMAIL=recruiter2@test.com -e PASSWORD=pass456    # optional, for the isolation check

# Admin tier (200 req/60s, userId-keyed)
k6 run admin-rate-limit.js \
  -e BASE_URL=https://jobsforwomen-266w.onrender.com \
  -e ADMIN_EMAIL=admin@test.com -e ADMIN_PASSWORD=pass123

# Upload tier (10 uploads/10min, userId-keyed) -- USE A DISPOSABLE ACCOUNT
k6 run upload-rate-limit.js \
  -e BASE_URL=https://jobsforwomen-266w.onrender.com \
  -e CANDIDATE_EMAIL=disposable-candidate@test.com -e CANDIDATE_PASSWORD=pass123

# Search tier (300 req/60s, IP-keyed)
k6 run search-rate-limit.js \
  -e BASE_URL=https://jobsforwomen-266w.onrender.com \
  -e CANDIDATE_EMAIL=candidate@test.com -e CANDIDATE_PASSWORD=pass123

# Optional: Redis concurrency stress test (global tier, no credentials needed)
k6 run stress-test.js \
  -e BASE_URL=https://jobsforwomen-266w.onrender.com \
  -e STRESS_VUS=30 -e STRESS_DURATION=30s

# Realistic workflow load test -- run once per target concurrency level.
# See section 9 for why CANDIDATE_POOL is capped at 10 accounts and why
# apply/message stays small regardless of PEAK_VUS.
k6 run workflow-load-test.js \
  -e BASE_URL=https://jobsforwomen-266w.onrender.com \
  -e CANDIDATE_POOL="cand1@test.com:pass1,cand2@test.com:pass2,cand3@test.com:pass3" \
  -e PEAK_VUS=100

k6 run workflow-load-test.js -e BASE_URL=... -e CANDIDATE_POOL="..." -e PEAK_VUS=500
k6 run workflow-load-test.js -e BASE_URL=... -e CANDIDATE_POOL="..." -e PEAK_VUS=1000
```

Run scripts **one at a time**, not concurrently against the same target -- several tiers share the global IP-keyed bucket, and the auth/upload tiers have small enough budgets that overlapping runs will contaminate each other's results.

## 4. Design Notes Worth Knowing Before You Read Results

- **Every script but `stress-test.js` runs as a single VU, sequentially.** Rate-limit *boundaries* ("request #150 succeeds, #151 doesn't") are only deterministic to assert on if requests are strictly ordered -- concurrent VUs racing for the same budget would make "the Nth request" ambiguous. Concurrency correctness (does the counter stay accurate when many requests race?) is what `stress-test.js` is for instead.
- **The global tier (100 req/60s) is stricter than several others** and applies to *every* route before any other limiter runs. Left alone, a script walking the candidate tier's 150-request budget would get rejected by the *global* limiter around request #100 -- correctly rejected, but by the wrong tier. `shared/helpers.js`'s `authGet`/`authPost`/`login` wrappers self-pace (a client-side approximation of the global counter) and will pause for a fresh window as they approach the global ceiling, so the candidate/recruiter/admin/search scripts can actually reach their own tier's boundary. This is why those scripts can take several minutes to run (`maxDuration` is set generously to match) rather than being contamination or a bug.
- **Render free-tier cold starts** (30-60s for the first request after idle) are absorbed by an explicit warm-up call at the start of each script, and the default request timeout is 60s. A slow *first* request is expected and not a failure.
- **User-isolation checks** (candidate/recruiter scripts) need a genuinely separate account of the same role. If you only supply the primary role-specific credentials, the isolation scenario logs a warning and skips itself rather than failing.

## 5. Expected Output

Each script prints structured, timestamped log lines (`[INFO]`/`[WARN]`/`[ERROR]`) as it runs, e.g.:

```
[2026-07-22T10:00:01.000Z] [INFO ] [global] Testing global tier: 100 req / 60s against https://.../health
[2026-07-22T10:00:04.211Z] [INFO ] [global] Phase 1 complete: 50 requests sent, all succeeded, X-RateLimit-Remaining last seen = 50.
...
[2026-07-22T10:01:10.442Z] [INFO ] [global] Phase 3 complete: post-reset request succeeded with X-RateLimit-Remaining=99 (expected close to 99).
```

k6's own end-of-run output follows, then this suite's custom summary block:

```
==============================================================================
  GLOBAL RATE LIMIT TEST SUMMARY (100 req / 60s, IP-keyed)
==============================================================================
  Total HTTP requests   : 106
  Failed request rate   : 0.00%
  Request duration      : avg=142.31ms p95=310.02ms max=612.10ms
  Checks passed         : 99.53% (423 passed / 2 failed)
------------------------------------------------------------------------------
  Custom metrics:
    global_rl_success_responses    : 100
    global_rl_429_responses        : 6
    global_rl_remaining_at_boundary: avg=0
==============================================================================
```

Each script also writes a `<script-name>-summary.json` file (full raw k6 metrics) in the working directory for CI archiving or deeper analysis -- add `-e K6_OUT=...` or redirect `handleSummary`'s output path if you want it elsewhere.

## 6. Interpreting Results

- **`checks` rate near 100%** is the headline signal. Every script's threshold is `checks: ['rate>0.95']` -- a run that drops below that failed real assertions, not just cosmetic warnings.
- **Status codes**: requests within budget should be `200`/`201`; requests past the boundary should be `429`. A `401`/`403` where `200` was expected usually means bad credentials, an inactive account, or (for recruiter) an unapproved company. A `500` anywhere is a genuine server-side problem, not a rate-limit outcome, and should be investigated on its own.
- **`X-RateLimit-Limit`** should match the tier's configured max exactly (100/10/150/150/200/10/300). If it doesn't, either the deployed environment has non-default `RATE_LIMIT_*` env vars (pass matching `-e RL_<TIER>_MAX=...` overrides) or you hit a *different* limiter than intended (e.g. the global tier instead of candidate -- see the pacing note above).
- **`X-RateLimit-Remaining`** should decrease by 1 per request within a window and never go negative.
- **`Retry-After`** on 429s should be a small positive integer, roughly matching (but not exceeding) the tier's window.
- **`stress-test.js`**: `stress_success_responses` should land close to (not far above) the global tier's max. A count *far* above it (tens of extra successes) would indicate the limiter isn't enforcing atomically under concurrency -- exactly the class of bug Redis's atomic `INCR` exists to prevent versus a naive read-then-write counter.

## 7. Redis Validation & Distributed Execution

`stress-test.js` fires many concurrent VUs at `GET /health` (the global tier binds first for any concurrent burst from one IP, so it's the tier that's actually testable this way from a single machine) and checks the counter never meaningfully over-allows requests under a race.

What it does and doesn't prove:
- **Does prove**: the rate limiter's `redis.incr()` stays atomically correct when many requests hit it at once from one process.
- **Doesn't prove, on its own, against a single backend instance**: that Redis (vs. the in-memory fallback) is actually what's keeping the count correct -- a single Node process's in-memory `Map` would also pass this test, since there's only one process's memory to race against. Redis specifically earns its keep once the backend is horizontally scaled to multiple instances behind a load balancer, each of which would otherwise keep its own independent in-memory counter.

To get real signal on the multi-instance case:
- If the Render service is scaled to more than one instance, just run `stress-test.js` as-is -- the load balancer will spread requests across instances, and a passing result then genuinely demonstrates Redis (not per-instance memory) is the source of truth.
- To generate load from multiple distinct client IPs (useful for confirming IP-keyed tiers isolate correctly across sources), run the script simultaneously from several machines/CI runners against the same `BASE_URL`, or use `k6 cloud stress-test.js` (requires a Grafana Cloud k6 account) / `xk6-distributed` to fan a single run out across multiple load generators.

## 8. Workflow Load Test (Realistic Multi-Step Scenarios at Scale)

`workflow-load-test.js` is a different kind of test from the rest of the suite: instead of walking one tier's exact boundary with a single VU, it simulates real user sessions -- login, browse jobs, check notifications, view conversations, and (in a small, separate scenario) actually apply to a job and message about it -- at genuinely concurrent scale.

**Two scenarios in one script:**
- `browse_at_scale` -- read-only (dashboard, browse jobs, notifications, conversations list). Ramps from 0 up to `PEAK_VUS` over two 30s stages, holds for `HOLD_DURATION`, then ramps back down. Safe to run at 100, 500, or 1000 VUs -- nothing here mutates data.
- `apply_and_message` -- real mutations (apply to a job, start a conversation, send a message). Deliberately fixed at `APPLY_VUS` (default 5) *regardless* of `PEAK_VUS`. Two independent reasons it doesn't scale with the rest: it writes real rows (applications, conversations, messages) that you'd otherwise need to clean up by the thousand, and `POST /jobs/:jobId/apply` is gated by `requireVerifiedEmail` + `requireProfileCompleted` (profile must be >= 70% complete) -- accounts that don't meet that just get a 403, logged and counted, not a script failure.

**Why login happens once in `setup()`, not per VU:** every VU in a local run shares one egress IP, and the auth tier allows only 10 logins/15min *per IP, total* -- not per account. If 1000 VUs each called the login endpoint, roughly 990 of them would be rejected with 429 before the test even got going. Instead, `setup()` logs in once per `CANDIDATE_POOL` account and hands the tokens to every VU via k6's standard `setup()` return-value mechanism, which is also just... how real sessions work. This is also why `CANDIDATE_POOL` is capped at 10 accounts: `setup()` logs every one of them in back-to-back, and a bigger pool would trip the auth limiter during setup itself.

**What "success" looks like at 500-1000 VUs:** with N pooled accounts, the system-wide sustainable throughput for candidate-tier endpoints is roughly `N * 150` requests per 60s (each account's own budget). Hundreds of VUs sharing a handful of accounts will exceed that on purpose once you scale past ~100 VUs, and you'll see a rising `workflow_browse_rate_limited` count as a result -- that's the rate limiter correctly protecting each account, not the test failing. `checkRateAware()` (`shared/helpers.js`) treats a 429 as a valid, fully-verified outcome (still checks for a real `Retry-After` header) rather than lumping it in with genuine failures, so the `checks` pass rate stays meaningful even under heavy contention. Look at the `workflow_*` custom metrics in the summary to see the real success/rate-limited/unexpected split, and treat a rising 429 rate as the throughput ceiling you just found, not a bug report.

**Token lifetime:** access tokens last 15 minutes and are minted once in `setup()`, not refreshed mid-run. Keep a single invocation's total duration (all stages + hold) comfortably under that, or split a longer soak into several shorter runs.

**Running 1000 VUs from one machine:** k6 is efficient, but 1000 concurrent connections can still hit local OS limits (open file descriptors, ephemeral ports). If you see connection errors that scale with VU count rather than clean 429s, raise your `ulimit -n` first before assuming it's a backend problem. For genuinely large-scale or geographically distributed load, k6 supports `k6 cloud` (Grafana Cloud k6) or running coordinated instances yourself.

## 9. Troubleshooting

| Symptom | Likely cause / fix |
|---|---|
| `[auth] Login failed for "..." (status=401)` during `setup()` | Wrong credentials, or the account's email isn't verified / is blocked / suspended. Log in via the frontend once to confirm the account works. |
| Every request in a run is `429` from the start | You're re-running within the same tier's window as a previous run (especially `auth-rate-limit.js`'s 15-minute budget, or `upload-rate-limit.js`'s 10-minute budget). Wait out the window or use a different test account. |
| `X-RateLimit-Limit` shows `100` when you expected `150`/`200`/`300` | You're seeing the *global* limiter reject first, not your target tier -- usually means the global-budget pacing guard in `shared/helpers.js` wasn't given enough headroom (e.g. you ran two scripts back-to-back against the same IP within 60s). Space runs out, or lower `STRESS_VUS`/wait between scripts. |
| First request in a run is very slow (10-60s) but succeeds | Expected Render free-tier cold start. Not a failure. |
| `recruiter-rate-limit.js` functional checks return `403` | The recruiter account's company isn't approved yet for endpoints requiring `requireApprovedCompany` -- but the endpoints this script uses (dashboard/analytics/settings/notifications) don't require that, so a 403 here more likely means the account itself is blocked/suspended. |
| Isolation scenario logs "skipped" | No distinct secondary account was supplied (`EMAIL`/`PASSWORD` missing, or identical to the primary role account). Supply a second, genuinely different account of the same role to exercise it. |
| `upload-rate-limit.js` fails on the file upload with a 400 | Confirm the fixture at `shared/fixtures/sample-resume.pdf` wasn't modified/corrupted -- it must remain a valid PDF under multer's `application/pdf` filter. |
| `ENOENT`/`open()` error for the PDF fixture | Run k6 from *inside* the `k6-load-tests/` directory (`open()` paths are relative to the script's working directory), not from a parent folder. |
| Script hangs for minutes | Expected for candidate/recruiter (up to ~5 min), admin (~6 min), and search (~8 min) -- see the global-budget pacing note in section 4. Check the `[global-guard]` log lines; they explain each pause. |
| `workflow-load-test.js` fails in `setup()` with an auth-related error | `CANDIDATE_POOL` has more than 10 accounts (trip's the auth tier logging them all in), or one of the pooled accounts' credentials is wrong/unverified. Check the `[ERROR] [auth]` line for which account. |
| `workflow_applications_gated_403` is high | Expected if your pooled accounts don't have a verified email and a >=70%-complete profile -- `apply` is gated on both. Not a bug; either complete those accounts' profiles or treat the 403 rate as informational. |
| `workflow_browse_rate_limited` rises sharply above ~100 VUs | Expected -- see section 8's throughput-ceiling explanation. Add more accounts to `CANDIDATE_POOL` (up to the 10-account cap) to raise the ceiling, or treat it as the measured result. |
| `workflow-load-test.js` gets connection errors that scale with `PEAK_VUS` | Likely a local OS limit (file descriptors/ephemeral ports), not the backend -- raise `ulimit -n` before the run. |

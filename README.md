# JobsForWomen

A full-stack job platform connecting women with employers offering flexible, inclusive, and returnship-friendly roles. Three user roles — **Candidate**, **Recruiter**, and **Admin** — each with a dedicated workspace, real-time messaging, and a complete hiring pipeline from application through to offer.

---

## Stack

| Layer | Technology |
| :--- | :--- |
| **Frontend** | React 19, TypeScript, Vite, Tailwind CSS v4, shadcn/ui, React Router 7 |
| **Backend** | Node.js 22, Express 5, TypeScript |
| **Database** | PostgreSQL with Prisma ORM |
| **Cache & Queues** | Redis (BullMQ jobs, rate-limit counters, permission cache, Socket.IO fanout) |
| **Real-time** | Socket.IO with Redis adapter (`/candidate`, `/recruiter`, `/admin` namespaces) |
| **Email** | AWS SES v2 (region `ap-south-1`) |
| **File storage** | Local disk on a persistent volume, served via HMAC-signed, time-limited URLs |
| **Containers** | Docker (multi-stage builds for both frontend and backend) |

---

## Features

**Candidate** — profile building with completion scoring, resume upload, job search with filters for progressive benefits, saved jobs, one-click apply, application timeline tracking, real-time chat with recruiters, and notifications.

**Recruiter** — company profile and verification, job posting with admin moderation, applicant pipeline management (shortlist → interview → offer), interview scheduling, offer release with letter attachment, team invitations, and analytics.

**Admin** — company approval workflow, job moderation, perk request review, user management, role and permission administration, feature flags, audit logs, and a live system health dashboard.

**Platform** — JWT authentication with refresh-token rotation, Google OAuth, seven-tier rate limiting, role-based access control, structured audit logging, background job queues with a dead-letter queue, and email delivery tracking.

---

## Quick Start

### Option A — Docker (fastest; no local database needed)

```bash
cd backend
docker compose up --build                          # API + PostgreSQL + Redis
docker compose exec api npx prisma migrate deploy   # apply schema
```

Then run the frontend:

```bash
cd frontend
npm install
npm run dev          # http://localhost:5173
```

### Option B — Local services

Requires PostgreSQL 15+ and Redis 6+ running locally.

```bash
# Backend
cd backend
cp .env.example .env          # then fill in the values -- see docs/04
npm install
npx prisma generate
npx prisma migrate dev
npm run seed
npm run dev                   # http://localhost:5000

# Frontend (separate terminal)
cd frontend
npm install
npm run dev                   # http://localhost:5173
```

**Default admin login:** `admin@jobsforwomen.info` / `admin123`

> These are development-only bootstrap credentials created by the seed script. **Change the password or delete the account before any environment is publicly reachable.**

---

## Documentation

Full documentation lives in [`docs/`](docs/). Start with whichever matches your task:

| I want to... | Read |
| :--- | :--- |
| **Deploy, debug an outage, or repair something** | **[Operations Runbook](docs/OPERATIONS_RUNBOOK.md)** ([PDF](docs/JobsForWomen_Operations_Runbook.pdf)) |
| Understand the system at a high level | [01. Project Overview](docs/01_PROJECT_OVERVIEW.md) |
| Find my way around the code | [02. Repository Structure](docs/02_REPOSITORY_STRUCTURE.md) |
| Get set up locally | [03. Installation Guide](docs/03_INSTALLATION_GUIDE.md) · [26. Developer Onboarding](docs/26_DEVELOPER_ONBOARDING.md) |
| Configure environment variables | [04. Environment Variables](docs/04_ENVIRONMENT_VARIABLES.md) |
| Call the API | [08. API Reference](docs/08_API_REFERENCE.md) |
| Understand auth and permissions | [09. Authentication](docs/09_AUTHENTICATION.md) · [10. RBAC](docs/10_RBAC.md) |
| Deploy to Render, AWS, or Docker | [16. Build & Deployment](docs/16_DEPLOYMENT.md) |
| Diagnose a specific failure | [17. Debugging](docs/17_DEBUGGING.md) |
| Review security posture | [18. Security](docs/18_SECURITY.md) |
| Run or extend the tests | [19. Testing](docs/19_TESTING.md) |
| Plan for growth | [21. Scaling](docs/21_SCALING.md) |

**The [Operations Runbook](docs/OPERATIONS_RUNBOOK.md) is the single most useful document here.** It covers architecture, platform-neutral deployment with concrete Render/AWS/Docker recipes, an incident triage decision tree, per-subsystem repair procedures, rollback, and — importantly — a candid list of known defects and landmines in §12.

---

## Testing

```bash
# Backend unit and integration tests
cd backend && npm test

# Type checking
cd backend && npx tsc --noEmit
cd frontend && npx tsc --noEmit -p tsconfig.app.json

# Load testing (rate-limit tiers and realistic workflows)
cd k6-load-tests && k6 run candidate-rate-limit.js -e BASE_URL=<url> -e CANDIDATE_EMAIL=... -e CANDIDATE_PASSWORD=...
```

See [`k6-load-tests/README.md`](k6-load-tests/README.md) for the full load-test suite.

---

## Deployment

Both halves are containerized and platform-neutral:

```bash
# Backend
cd backend && docker build -t jobsforwomen-api .

# Frontend (VITE_API_URL is a BUILD argument -- it is inlined into the bundle)
cd frontend && docker build -t jobsforwomen-web --build-arg VITE_API_URL=https://api.example.com .
```

Any host must provide Node 22, PostgreSQL, Redis, **persistent storage** for uploads, and WebSocket passthrough. Concrete recipes for Render, AWS (ECS/Fargate + RDS + ElastiCache + EFS), and generic Docker hosts are in [16. Build & Deployment](docs/16_DEPLOYMENT.md) and the runbook's §4.

> **Persistent storage is not optional.** Uploads are written to `DISK_MOUNT_PATH` on local disk. Ordinary container filesystems are wiped on every redeploy — without a real persistent volume, every uploaded file is destroyed on the next release.

---

## Project Status

The platform is feature-complete and documented, with automated tests and load tests in place. Before a production launch, see **§6 Final testing before handover** and **§12 Known defects** in the [Operations Runbook](docs/OPERATIONS_RUNBOOK.md) — the latter documents several genuine limitations, including scheduled jobs that are defined but never registered, three queues without workers, and a single-instance constraint imposed by disk-based file storage.

---

## Repository Layout

```
├── backend/          Express API, Prisma schema, background workers, Docker setup
├── frontend/         React SPA, Vite build, Docker + nginx setup
├── docs/             Full documentation set (27 files) + operations runbook
└── k6-load-tests/    Rate-limit and workflow load-testing suite
```

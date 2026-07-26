# 2. Repository Structure

This repository is structured as a monorepo split into two primary components: `backend/` and `frontend/`. Both environments utilize TypeScript to share type definitions where possible and maintain strict design boundaries.

---

## 2.1 Backend Folder Layout (`/backend`)

The backend follows a domain-driven modular structure grouped under `/src/modules`, alongside a shared utility layer.

```
/backend
├── prisma/                    # Schema and migrations directory
│   ├── migrations/            # DB migration history sql files
│   └── schema.prisma          # Database schema definition
├── src/
│   ├── app.ts                 # Express app setup, middlewares, and routers registration
│   ├── server.ts              # Entry point bootstrap starting HTTP & Socket servers
│   ├── database/              # DB seeder and admin bootstrap
│   │   ├── seed.ts            # DB seed script
│   │   └── create-admin.ts    # CLI to create a Super Admin account
│   ├── modules/               # Modular API domains
│   │   ├── admin/             # System config, flags, logs, verification controllers
│   │   ├── auth/              # JWT, OAuth, Registration, Verification endpoints
│   │   ├── candidate/         # Job applications, resume upload, profile endpoints
│   │   ├── company-verification/ # Company registration, approval histories
│   │   ├── rbac/              # Role, permission, and access middleware layer
│   │   └── recruiter/         # Job posting, team management, metrics
│   ├── scripts/               # One-off maintenance scripts (storage migration)
│   └── shared/                # Common resources across domains
│       ├── config/            # Env loaders (Zod schemas)
│       ├── database/          # Prisma client singleton
│       ├── eventBus/          # Pub/sub event hub (EventBus)
│       ├── listeners/         # Event listeners (Audit, Notifications, emails)
│       ├── middleware/        # Auth, rate limiting, uploads, errors, request IDs
│       ├── queue/             # BullMQ queues, workers, dead-letter queue, scheduler
│       ├── routes/            # Cross-cutting routes (files.routes.ts)
│       ├── services/          # Shared domain services (conversations, etc.)
│       ├── socket/            # Socket.IO server, namespaces, Redis adapter
│       └── utils/             # Logger, file storage, email, tokens, response helpers
├── Dockerfile                 # Two-stage production image (see docs 16)
├── docker-compose.yml         # Local full stack: api + postgres + redis
├── nginx.conf                 # Reverse-proxy config for VPS/self-hosted deploys
├── .dockerignore              # Excludes node_modules, .env, uploads, logs from builds
└── package.json               # Backend npm configurations
```

> Note: `src/sockets/`, `src/workers/`, `src/queues/`, and `src/emails/` exist on disk but are **empty placeholders**. The real implementations live under `src/shared/socket/` and `src/shared/queue/` respectively.

---

## 2.2 Frontend Folder Layout (`/frontend`)

The frontend uses a modern feature-oriented architectural pattern. Shared layout shells are placed in `/layouts`, and domain-specific routing structures are placed in `/routes`.

```
/frontend
├── src/
│   ├── api/                   # Hand-rolled HTTP clients (client.ts) and socket setups (socket.ts)
│   ├── app/                   # Root App hooks and configuration
│   ├── components/            # Reusable UI elements (ui/ buttons, inputs, cards)
│   │   ├── dashboard/         # Dashboard layout parts (charts, feed, cards, skeletons)
│   │   └── shared/            # Shared status indicators, badges, layouts
│   │       └── skeletons/     # Page-level loading placeholders (PageSkeletons.tsx)
│   ├── contexts/              # React Context providers (Auth, Notifications)
│   ├── features/              # Feature modules containing pages, hooks, services
│   │   ├── admin/             # Admin page views (Moderation, Health, Configs)
│   │   ├── auth/              # User Login, SignUp, Password forms
│   │   ├── candidate/         # Profile, Dashboard, Job Explore pages
│   │   ├── recruiter/         # Post Job, Manage Jobs, Recruiter Dashboards
│   │   ├── jobs/              # Job detail pages
│   │   └── landing/           # Landing homepage views
│   ├── hooks/                 # General hooks (useAuth, useLocalStorage)
│   ├── layouts/               # Shell layout components (Admin, Candidate, Recruiter grids)
│   ├── routes/                # Client-side router declarations (AppRouter, route protection)
│   ├── types/                 # Shared TypeScript models and interface declarations
│   ├── utils/                 # Formatting, date helpers
│   ├── index.css              # Global custom styling sheet
│   └── main.tsx               # Client entry bootstrap mounting React DOM
├── Dockerfile                 # Two-stage build: Vite bundle -> nginx (see docs 16)
├── nginx.conf                 # SPA fallback, gzip, cache headers for the container
├── .dockerignore              # Excludes node_modules, dist, .env from builds
├── vercel.json                # SPA rewrite rule for Vercel deploys
└── package.json               # Frontend npm configurations
```

---

## 2.3 Repository Root

```
/
├── backend/                   # Express API (see 2.1)
├── frontend/                  # React SPA (see 2.2)
├── docs/                      # This documentation set
│   └── OPERATIONS_RUNBOOK.md  # Incident response & deployment runbook
└── k6-load-tests/             # Rate-limit and workflow load-test suite
```

---

## 2.4 Routing Architecture

### Backend Routes:
Backend routes are grouped in modules and registered in `app.ts` under prefix `/api/v1/`:
* `auth`: `/api/v1/auth` (Login, registration, password resets, Google OAuth callback)
* `candidate`: `/api/v1/candidates` (Profile retrieval, resume uploading, job search, apply actions)
* `recruiter`: `/api/v1/recruiters` (Job creation/updates, application moderation, metrics, coworker invites)
* `admin`: `/api/v1/admins` (Verify companies, audit logs, feature flags, system health check) — note the **plural** mount point in `app.ts`
* `rbac`: `/api/v1/rbac` (Role and permission management)
* `company-verification`: `/api/v1/company-verification` (Public, token-authenticated resubmission flow)
* `files`: `/files/jfw/:type/:filename` (Uploaded file delivery — **not** under `/api/v1`)
* Health probes: `/health`, `/live`, `/ready`, `/version` (mounted at the app root)

### Frontend Routes:
Frontend routes are managed in `src/routes/AppRouter.tsx` using `react-router-dom`:
* `/`: Public landing page.
* `/auth/*`: Login, registration, recovery routing mapped in `AuthRoutes.tsx`.
* `/candidate/*`: Guarded paths for candidate workspaces mapped in `CandidateRoutes.tsx`.
* `/recruiter/*`: Guarded paths for recruiter panels mapped in `RecruiterRoutes.tsx`.
* `/admin/*`: Guarded paths for system operator consoles mapped in `AdminRoutes.tsx`.
* `/jobs/:id`: Public/authenticated job detailed description.

Protected routes use `<ProtectedRoute>` wrapping components to validate authorization parameters and redirect non-compliant clients back to login.

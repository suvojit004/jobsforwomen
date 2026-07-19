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
│   ├── database/              # DB clients and seeder
│   │   └── seed.ts            # DB seed script
│   ├── modules/               # Modular API domains
│   │   ├── admin/             # System config, flags, logs, verification controllers
│   │   ├── auth/              # JWT, OAuth, Registration, Verification endpoints
│   │   ├── candidate/         # Job applications, resume upload, profile endpoints
│   │   ├── company-verification/ # Company registration, approval histories
│   │   ├── rbac/              # Role, permission, and access middleware layer
│   │   └── recruiter/         # Job posting, team management, metrics
│   ├── shared/                # Common resources across domains
│   │   ├── config/            # Env loaders (Zod schemas)
│   │   ├── eventBus/          # Pub/sub event hub (EventBus)
│   │   ├── listeners/         # Event listeners (Notifications, emails)
│   │   ├── queue/             # BullMQ queue managers and Redis workers
│   │   └── utils/             # Loggers, encryptors, email helpers
│   ├── sockets/               # Sockets namespaces and events registration
│   └── workers/               # Background task scheduler jobs
└── package.json               # Backend npm configurations
```

---

## 2.2 Frontend Folder Layout (`/frontend`)

The frontend uses a modern feature-oriented architectural pattern. Shared layout shells are placed in `/layouts`, and domain-specific routing structures are placed in `/routes`.

```
/frontend
├── src/
│   ├── api/                   # Hand-rolled HTTP clients (client.ts) and socket setups (socket.ts)
│   ├── app/                   # Root App hooks and configuration
│   ├── components/            # Reusable UI elements (ui/ buttons, inputs, cards)
│   │   ├── dashboard/         # Dashboard layout parts (charts, feed, cards)
│   │   └── shared/            # Shared status indicators, badges, layouts
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
└── package.json               # Frontend npm configurations
```

---

## 2.3 Routing Architecture

### Backend Routes:
Backend routes are grouped in modules and registered in `app.ts` under prefix `/api/v1/`:
* `auth`: `/api/v1/auth` (Login, registration, password resets, Google OAuth callback)
* `candidate`: `/api/v1/candidates` (Profile retrieval, resume uploading, job search, apply actions)
* `recruiter`: `/api/v1/recruiters` (Job creation/updates, application moderation, metrics, coworker invites)
* `admin`: `/api/v1/admin` (Verify companies, audit logs, feature flags, system health check)

### Frontend Routes:
Frontend routes are managed in `src/routes/AppRouter.tsx` using `react-router-dom`:
* `/`: Public landing page.
* `/auth/*`: Login, registration, recovery routing mapped in `AuthRoutes.tsx`.
* `/candidate/*`: Guarded paths for candidate workspaces mapped in `CandidateRoutes.tsx`.
* `/recruiter/*`: Guarded paths for recruiter panels mapped in `RecruiterRoutes.tsx`.
* `/admin/*`: Guarded paths for system operator consoles mapped in `AdminRoutes.tsx`.
* `/jobs/:id`: Public/authenticated job detailed description.

Protected routes use `<ProtectedRoute>` wrapping components to validate authorization parameters and redirect non-compliant clients back to login.

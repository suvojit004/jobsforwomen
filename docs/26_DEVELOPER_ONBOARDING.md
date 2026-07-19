# 26. Developer Onboarding Guide

This guide helps new engineers get started with development on the platform.

---

## 26.1 Local Setup Checklist

1. **Verify Prerequisites**: Install Node.js `v22.x`, PostgreSQL, and Redis.
2. **Clone & Configure**:
   * Clone the workspace: `git clone ...`
   * Copy env templates: `cp backend/.env.example backend/.env` and `cp frontend/.env.example frontend/.env`.
3. **Database Bootstrap**:
   * Navigate to `backend/`.
   * Install packages: `npm install`.
   * Apply database schemas: `npx prisma generate` and `npx prisma migrate dev`.
   * Seed tables: `npm run seed`.
4. **Boot Services**:
   * Start backend dev server: `npm run dev` inside `backend/`.
   * Start frontend dev server: `npm run dev` inside `frontend/`.
5. **Access Platform**: Open `http://localhost:3000` (or `http://localhost:5173`) in your browser. Log in with the default admin account:
   * **Username**: `admin@jobsforwomen.info`
   * **Password**: `admin123`

---

## 26.2 Coding Standards & Conventions

* **TypeScript Strict Mode**: Keep strict type validations enabled. Avoid using `any` unless absolutely necessary (or explicitly documented).
* **Naming Conventions**:
  * **Folders & Files**: Use `camelCase` for utilities/helpers, and `PascalCase` for React components/layouts (e.g. `ResumeCard.tsx`).
  * **APIs**: Route paths must be lowercase and use kebab-case (e.g. `/api/v1/saved-jobs`).
* **Zod Validation**: Always declare Zod schemas for all inbound request bodies and validate them before processing.

---

## 26.3 Git & Branching Strategy

We follow the standard Git Flow branching model:

```
main (Production)
  └── release (Staging/Release candidates)
        └── develop (Integration)
              ├── feature/auth-updates
              └── bugfix/email-timeout
```

* **Branch Naming**:
  * Features: `feature/short-description`
  * Bugfixes: `bugfix/short-description`
  * Hotfixes: `hotfix/short-description`
* **Pull Request Rules**:
  * Create pull requests targeting `develop`.
  * Confirm that `npm run build` compiles with zero errors on both backend and frontend.
  * Ensure the backend test suite passes: `npm run test` inside `backend`.
  * All PRs require review and approval from at least one repository maintainer.

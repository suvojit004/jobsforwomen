# 16. Build & Deployment

This document covers compiling and deploying the frontend and backend architectures to production.

---

## 16.1 Frontend Deployment (Vercel)

The React SPA is optimized for serverless deployments on **Vercel**.

### 1. SPA Rewrite Rule (`vercel.json`)
To prevent HTTP 404 errors on browser page refreshes of client-side nested paths (such as `/candidate/profile`), Vercel is configured with rewrites to route all traffic back to `/index.html`:
```json
{
  "rewrites": [
    {
      "source": "/:path*",
      "destination": "/index.html"
    }
  ]
}
```

### 2. Deployment Setup
* **Build Command**: `npm run build` (runs `tsc -b && vite build` to compile assets into the `/dist` directory).
* **Output Directory**: `dist`
* **Production Environment Variables**:
  * `VITE_API_URL`: The absolute HTTPS endpoint of your backend (e.g. `https://api.jobsforwomen.info`).

---

## 16.2 Backend Deployment (Render)

The backend Express app and workers run inside **Render.com** environments.

### 1. Environment Configurations
* **API Web Service**: Runs the HTTP server, handles API requests, and establishes client namespaces for Sockets connections.
  * **Build Command**: `npm run build` (triggers `npx prisma generate && tsc` to compile TypeScript to Javascript in `/dist`).
  * **Start Command**: `npm start` (`node dist/server.js`)
* **Background Worker Service**: Runs the queue subscriber worker in a separate container.
  * **Start Command**: `node dist/shared/queue/queue.js` (starts Redis consumers for the `email` and `cleanup` queues).

### 2. Environment Variables Mapping
* Map all required variables (see [4. Environment Variables](04_ENVIRONMENT_VARIABLES.md)) in Render's dashboard.
* **Pre-deployment Migration**: Render services are configured to run migrations before launching the new server container instance:
  ```bash
  npx prisma db push --force-reset || npx prisma migrate deploy
  ```

---

## 16.3 Production Release Checklist

Before releasing a new version, complete this checklist:

1. **Database Schema Compliance**:
   * Verify all new Prisma columns are applied to PostgreSQL.
   * Run `npx prisma migrate status` to check history.
2. **Secrets Configuration Check**:
   * Confirm `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` are customized in production (do not use development default strings).
   * Ensure `RESEND_API_KEY` is active.
3. **Google OAuth Authorized Redirect URIs**:
   * Verify the callback URL on Google Cloud Console matches your production address: `https://api.jobsforwomen.info/api/v1/auth/google/callback`.
   * Add the client homepage URL to authorized JavaScript origins.
4. **Cache & Queues Reset**:
   * Flush outdated user permission keys in Redis if RBAC permissions were modified.
   * Clear any stuck jobs in Redis using a BullMQ utility script.

# 16. Build & Deployment

This document covers compiling and deploying the frontend and backend to production. It is platform-neutral: §16.1 states what any host must provide, and §16.5–16.7 give concrete recipes for Render, AWS, and any Docker host.

> For incident response, rollback, custom-domain cutover, and pre-handover testing, see [OPERATIONS_RUNBOOK.md](OPERATIONS_RUNBOOK.md).

---

## 16.1 Platform Requirements

Any host — Render, AWS, Azure, GCP, a bare VPS — must satisfy all of the following. Everything else is a matter of which buttons you press.

| Requirement | Detail |
| :--- | :--- |
| **Node 22.x runtime** | Declared in `backend/package.json` `engines`. Native modules (`bcrypt`) are compiled against it. |
| **PostgreSQL** | Reachable via `DATABASE_URL`. Prisma 6.19.3. |
| **Redis** | Reachable via `REDIS_URL`. Required for BullMQ; without it **no emails are sent**. Rate limiting and the permission cache degrade gracefully; queues do not. |
| **Persistent file storage** | A durable volume mounted at `DISK_MOUNT_PATH`. Ordinary container filesystems are wiped on redeploy — without this, every uploaded file is destroyed on the next release. |
| **Single instance** | The persistent disk cannot be shared across replicas, so the API **cannot be horizontally scaled** as currently built. See [21. Scaling](21_SCALING.md). |
| **Long-lived connections** | Socket.IO needs WebSocket upgrades to pass through any proxy or load balancer, with generous idle timeouts. |
| **Outbound HTTPS** | To AWS SES (email) and Google (OAuth). |
| **A way to run migrations** | Shell access, a one-off task, or an exec into the running container. |

### Migrations

```bash
npx prisma migrate deploy
```

> [!WARNING]
> Never run `prisma db push --force-reset` against a production database. It drops and recreates the schema, destroying all data. Earlier revisions of this document contained that command in a pre-deploy step; it was wrong. Use `prisma migrate deploy`, and take a database backup before any migration that drops or renames a column.

Run migrations from a context that can reach the database. Note that on some platforms (Render in particular) build steps and one-off jobs run on *separate compute* that cannot see the persistent disk — migrations are fine there, but anything touching uploaded files must run on the live instance.

---

## 16.2 Backend Build

* **Build**: `npm run build` → `npx prisma generate && tsc`, emitting `dist/`.
* **Start**: `npm start` → `node dist/server.js`.
* **Health probes**: `/live` (process), `/ready` (process + database), `/health` (full subsystem JSON).

## 16.3 Frontend Build

* **Build**: `npm run build` → `tsc -b && vite build`, emitting `dist/`.
* **Output**: static files. Serve them from any static host or CDN.
* **SPA rewrite required**: all unmatched paths must return `index.html`, or refreshing a nested route like `/candidate/profile` 404s. `vercel.json` does this for Vercel; `frontend/nginx.conf` does it for the container.
* **`VITE_API_URL` is inlined at build time.** Vite substitutes `import.meta.env.*` when it compiles, so this cannot be changed at runtime — pointing the frontend at a different API requires a rebuild.

---

## 16.4 Containers

Both halves ship with production Dockerfiles.

| | Backend | Frontend |
| :--- | :--- | :--- |
| **File** | `backend/Dockerfile` | `frontend/Dockerfile` |
| **Stages** | Node builder → Node runtime | Node builder → nginx runtime |
| **Runs as** | non-root `node` | non-root (nginx-unprivileged) |
| **Port** | 5000 | 8080 |
| **Healthcheck** | `GET /health` | `GET /healthz` |
| **Needs a volume** | **Yes** — `/app/uploads` | No (stateless) |

```bash
# Backend
cd backend
docker build -t jobsforwomen-api:latest .
docker run -d -p 5000:5000 --env-file .env \
  -e NODE_ENV=production -e DISK_MOUNT_PATH=/app/uploads \
  -e BACKEND_URL=https://api.example.com \
  -v jfw_uploads:/app/uploads \
  jobsforwomen-api:latest

# Frontend (note: build-arg, not runtime env)
cd frontend
docker build -t jobsforwomen-web:latest \
  --build-arg VITE_API_URL=https://api.example.com .
docker run -d -p 8080:8080 jobsforwomen-web:latest
```

Two container details that cause real incidents if changed carelessly:

* **Backend:** `mkdir -p /app/uploads` must stay *before* `chown -R node:node /app`. Docker copies a directory's existing ownership into a volume on first mount; reverse the order and the non-root process cannot write uploads (`EACCES`).
* **Frontend:** `index.html` is served `no-cache` deliberately. It references year-cached hashed bundles, so caching it pins returning visitors to a previous deploy's asset filenames, which 404 once those files are gone.

A local full stack (API + Postgres + Redis) is available via `backend/docker-compose.yml` — see [3. Installation Guide](03_INSTALLATION_GUIDE.md).

---

## 16.5 Recipe: Render (historical — pre-cutover deployment)

> As of the AWS EC2 cutover documented in §16.7 and [OPERATIONS_RUNBOOK.md](OPERATIONS_RUNBOOK.md) §4–5, this is **no longer the current production recipe**, and the Render Postgres / Upstash Redis instances it describes have been **fully decommissioned** — Postgres and Redis both now run locally on the same EC2 server as the application (see §16.7 and the runbook's migration note). This recipe is kept here purely as a working, independent alternative should the platform move back to a managed host.

**Backend — Web Service**

1. Runtime: Node (build `npm run build`, start `npm start`) **or** Docker (uses `backend/Dockerfile`).
2. **Add a Persistent Disk** and set `DISK_MOUNT_PATH` to its mount path (e.g. `/var/data/uploads`). This requires a **paid instance type** — free instances cannot mount disks, have no shell, and spin down after 15 minutes idle.
3. Set `BACKEND_URL` to the service's public URL, and `NODE_ENV=production`.
4. Deploy, then open the Shell and run `npx prisma migrate deploy`.

Render specifics worth knowing: disks are single-instance only (no autoscaling); disks are **not** reachable from Build/Pre-Deploy commands or one-off jobs, only from the live instance's shell; free-tier services cold-start in 30–60s after idle.

**Frontend — Vercel** (or Render Static Site)

* Build `npm run build`, output `dist`, set `VITE_API_URL`, and redeploy after changing it.

**Managed services**: Render PostgreSQL, and Redis from Upstash (`rediss://`) or Render Key Value. *(Historical — see the note at the top of this section: the current deployment, §16.7, runs both locally on the EC2 host instead.)*

---

## 16.6 Recipe: AWS

A workable mapping for the same architecture. The persistent-storage choice is the only genuinely constrained decision.

| Concern | Service | Notes |
| :--- | :--- | :--- |
| **API** | ECS Fargate (or App Runner, or EC2 + Docker) | Run `backend/Dockerfile`. **Desired count = 1** until storage moves to S3. |
| **Database** | RDS for PostgreSQL | Put `DATABASE_URL` in Secrets Manager, inject as a task secret. |
| **Redis** | ElastiCache for Redis (or Upstash) | Must be reachable from the task's security group. |
| **File storage** | **EFS**, mounted into the task at `DISK_MOUNT_PATH` | EFS is the only option that keeps the current code unchanged *and* survives task replacement. An EBS volume works for a single EC2 host but not for Fargate. Instance storage does **not** persist. |
| **Frontend** | S3 + CloudFront | Set the CloudFront custom error response for 403/404 → `/index.html` (200) to get the SPA rewrite. Or run `frontend/Dockerfile` on ECS behind the same ALB. |
| **TLS / routing** | ALB + ACM certificate | **Enable stickiness and WebSocket support** for Socket.IO, and raise the idle timeout (default 60s will drop long-lived sockets). |
| **DNS** | Route 53 | `api.<domain>` → ALB, `<domain>` → CloudFront. |
| **Secrets** | Secrets Manager / SSM Parameter Store | Never bake `.env` into the image — `backend/.dockerignore` excludes it for this reason. |
| **Logs** | CloudWatch Logs | The app logs JSON to stdout/stderr. |
| **Migrations** | One-off ECS task with the same image and env, overriding the command to `npx prisma migrate deploy` | |

AWS-specific gotchas:

* **`app.set("trust proxy", 1)`** assumes exactly one proxy hop. Behind ALB alone that is correct. Add CloudFront in front of the API as well and `req.ip` resolves to the wrong address, which makes every IP-keyed rate-limit tier bucket all traffic together. Adjust the hop count to your real chain — but never set it to `true`, which lets clients forge `X-Forwarded-For`.
* **ALB idle timeout** must exceed your WebSocket keepalive or chat will silently drop.
* **EFS throughput mode**: bursting is usually fine at this scale, but watch burst credits if upload volume grows.
* Moving uploads to **S3** is what unlocks multi-task scaling. It requires replacing the `fs` calls in `shared/utils/fileStorage.ts` with S3 SDK calls; the signed-URL layer already exists and maps cleanly onto S3 presigned URLs.

---

## 16.7 Recipe: Any Docker host / VPS (current production deployment)

> This is what the platform actually runs today: both containers from §16.4 on a self-managed AWS EC2 instance, fronted by two host-level nginx instances that terminate TLS via Let's Encrypt/Certbot for `jobsforwomen.info` (frontend) and `api.jobsforwomen.info` (backend). See [OPERATIONS_RUNBOOK.md](OPERATIONS_RUNBOOK.md) for the full operational picture — that file is authoritative if it and this page ever diverge.

1. Provision Postgres and Redis. **Current production setup:** both run locally on the same EC2 host (not a managed provider) — confirm `DATABASE_URL`/`REDIS_URL` point at `localhost` (or the Docker network's internal hostname, if run as additional containers) on the live server.
2. Run the two images from §16.4, with a named volume or bind mount for uploads.
3. Terminate TLS and reverse-proxy with nginx. Two working host-level configs exist in the repo, install either the same way (`sudo cp <file> /etc/nginx/sites-available/...`, symlink into `sites-enabled`, then `certbot --nginx -d <domain>`):
   * **`backend/nginx.conf`** — the API reverse proxy for `api.jobsforwomen.info`: HTTP→HTTPS redirect, TLS 1.2/1.3, HSTS, gzip, `client_max_body_size 10M` matching Multer, and a `/socket.io/` location with WebSocket upgrade headers and 86400s timeouts.
   * **`frontend/nginx.host.conf`** — the frontend domain (`jobsforwomen.info` + `www`), reverse-proxying to the frontend *container* on `127.0.0.1:8080`. This is distinct from `frontend/nginx.conf`, which runs **inside** that container and does the actual SPA serving/fallback.
   * **`frontend/nginx.static.host.conf`** — an alternative to `nginx.host.conf` that skips the frontend container entirely and serves a `npm run build` output directly from the host filesystem (`/var/www/jobsforwomen.info`). A deploy under this approach is "rebuild, `cp -r dist/* /var/www/...`" rather than "build and run an image." Pick one of these two frontend approaches, not both.
4. Issue certificates with Certbot; both host configs already include the `/.well-known/acme-challenge/` location. Verify the renewal timer is active — an expired certificate is a total outage.
5. `docker exec` into the API container and run `npx prisma migrate deploy`.

> The CSP in `backend/nginx.conf` sets `script-src 'none'; style-src 'none'`, which blocks the Swagger UI at `/api/v1/api-docs` from rendering. Relax it for that path or accept that the docs page will not load in production.
> `frontend/nginx.host.conf` ships with its CSP header commented out/unset entirely — unlike the backend's lockdown policy, the frontend needs `script-src`/`style-src`/`connect-src` open enough for the React bundle and its calls back to the API to actually run.

---

## 16.8 Production Release Checklist

1. **Types and tests**: `npx tsc --noEmit` in both projects; `npm test` in `backend/`.
2. **Database**: `npx prisma migrate status` shows no drift; backup taken if the release includes a migration.
3. **Secrets**: `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` are long random values, not development placeholders. Rotating the access secret also invalidates every outstanding file link (see [20. Maintenance](20_MAINTENANCE.md)).
4. **`BYPASS_EMAIL_VERIFICATION` is not set** in any deployed environment.
5. **Storage**: `DISK_MOUNT_PATH` points at persistent storage, and `BACKEND_URL` is the real public API URL.
6. **Seeded admin**: the default `admin@jobsforwomen.info` / `admin123` account has been given a new password or deleted.
7. **Google OAuth**: the authorized redirect URI matches `GOOGLE_CALLBACK_URL` exactly, and the frontend origin is an authorized JavaScript origin.
8. **CORS**: the frontend origin is in the allowlist — set `CLIENT_URL`/`FRONTEND_URL`, which feed both `app.ts` and `shared/socket/socket.ts`. Hardcoding only one of those files leaves REST working while WebSockets fail.
9. **Email**: sending domain verified in AWS SES **in `AWS_SES_REGION`** (identities are regional); `npm run email:test` succeeds. If the account is still in the SES sandbox, delivery is limited to individually verified recipients.
10. **Smoke test**: `/live`, `/ready`, `/health`; then log in, send a chat message, and upload and reopen a file.

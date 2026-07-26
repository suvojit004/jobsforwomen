# =============================================================================
# JobsForWomen frontend -- production container
#
# Two stages: a Node builder that produces the static Vite bundle, and an
# nginx runtime that serves it. Mirrors backend/Dockerfile's posture: pinned
# base images, non-root at runtime, and a HEALTHCHECK.
#
# IMPORTANT -- VITE_API_URL is a BUILD-TIME argument, not a runtime variable.
# Vite substitutes import.meta.env.* into the bundle when it compiles, so the
# backend URL is baked into the JavaScript. Changing it later requires a
# rebuild; setting it with `docker run -e` has NO effect.
#
#   docker build -t jobsforwomen-web:latest \
#     --build-arg VITE_API_URL=https://api.jobsforwomen.info .
# =============================================================================

# --- Stage 1: build ----------------------------------------------------------
# Node 22 matches backend/package.json's declared "engines" field. (Note the
# backend Dockerfile currently pins node:20-alpine -- that inconsistency is
# tracked in docs/OPERATIONS_RUNBOOK.md §4.3.)
FROM node:22-alpine AS builder

WORKDIR /app

# Copy manifests first so `npm ci` is cached and only re-runs when
# dependencies actually change, not on every source edit.
COPY package*.json ./
RUN npm ci

COPY . .

# Fail the build immediately if the API URL wasn't supplied. Without this the
# build succeeds and produces a bundle that throws on every request at
# runtime -- frontend/src/api/client.ts logs a critical console error and
# every API call fails. A loud build failure is far cheaper to diagnose than
# a silently broken image.
ARG VITE_API_URL
RUN test -n "$VITE_API_URL" || \
    (echo "ERROR: --build-arg VITE_API_URL=... is required (e.g. https://api.jobsforwomen.info)" && exit 1)
ENV VITE_API_URL=$VITE_API_URL

# `npm run build` runs `tsc -b && vite build`, so a type error fails the
# image build rather than shipping a broken bundle.
RUN npm run build


# --- Stage 2: runtime --------------------------------------------------------
# nginx-unprivileged runs as a non-root user out of the box and listens on
# 8080 (binding :80 would require root). This is the same "drop privileges"
# posture as the backend image's `USER node`.
FROM nginxinc/nginx-unprivileged:alpine

# SPA routing, gzip, and cache headers -- see frontend/nginx.conf.
COPY nginx.conf /etc/nginx/conf.d/default.conf

COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 8080

# Hits the dedicated /healthz location rather than /, so the probe stays
# valid even if index.html is momentarily unreadable mid-deploy.
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -q --spider http://localhost:8080/healthz || exit 1

CMD ["nginx", "-g", "daemon off;"]

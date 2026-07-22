FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx prisma generate
RUN npm run build

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --only=production
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

# File uploads (resumes, logos, offer letters, etc.) are written to
# DISK_MOUNT_PATH (see shared/config/env.ts) using local disk storage. In
# production this MUST be a Render Persistent Disk mounted at that path --
# Render's regular container filesystem is wiped on every redeploy/restart.
# Persistent Disks are single-instance only (no autoscaling/multiple
# replicas). Created and chowned here (before USER node below) because a
# fresh Docker named volume mounted into this path is owned by root by
# default -- Docker copies this directory's existing ownership into the
# volume the first time it's mounted, which is what lets the non-root
# `node` user actually write into it instead of failing with EACCES.
RUN mkdir -p /app/uploads

# Set correct non-root permissions
RUN chown -R node:node /app
USER node

EXPOSE 5000

# Node-based zero-dependency lightweight healthcheck probe
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:5000/health', r => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

CMD ["node", "dist/server.js"]

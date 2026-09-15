# 21. Scaling Guide

This guide details the architectural plans for scaling the platform as user volume and traffic grow.

> [!IMPORTANT]
> **The service cannot currently run more than one instance.** Uploaded files are stored on a single persistent disk that cannot be shared across replicas. Everything below is achievable, but §21.4 is the prerequisite for all of it — nothing else in this document can be adopted until file storage moves to object storage.

---

## 21.1 Database Scaling (PostgreSQL)

PostgreSQL scaling can be implemented in phases:

1. **Read/Write Replica Splits**:
   * Migrate the Prisma configuration to use a write-primary connection and multiple read-replicas.
   * Direct intensive read requests (such as candidate job listings and dashboard metrics) to read replicas.
2. **Table Partitioning**:
   * Partition tables that grow quickly, such as `AuditLog`, `Message`, and `Notification`, by date ranges (e.g., monthly partitions) to improve lookup performance.
3. **Connection Pooling**:
   * Deploy **PgBouncer** or similar connection pooling utilities in front of PostgreSQL to handle high concurrent connection volumes without database exhaustion.

---

## 21.2 Horizontal Scaling of Real-Time WebSockets

When scaling HTTP web servers horizontally, Socket.IO connections face room synchronization challenges across multiple server nodes.

### Socket.IO Redis Adapter:
* **Already implemented.** `@socket.io/redis-adapter` is attached at boot in `shared/socket/socket.ts` using duplicated ioredis clients. If Redis is unreachable the code falls back to the in-memory adapter and logs `[SocketIO] Failed to attach Redis adapter` — at which point cross-instance fanout is silently gone. The live state is exposed as `socketAdapterStatus` (`redis` | `memory` | `error`).
* When a message or notification is emitted on Server Node A, the Redis adapter publishes it to a Redis pub/sub channel.
* All other server nodes receive the publish and emit it to sockets connected to their instances.
* Configure sticky sessions on your load balancer (e.g., NGINX, AWS ALB) to ensure client sockets route consistently to the same server node.

---

## 21.3 Caching & Queue Optimization

* **Redis Clustering**: Replace the single, self-hosted Redis instance (currently running locally on the same EC2 server as the API — see [OPERATIONS_RUNBOOK.md](OPERATIONS_RUNBOOK.md)) with a cluster or a managed provider to scale memory capacity, write throughput, and to decouple its availability from the API host's.
* **BullMQ Concurrency**:
  * Workers currently run **inside the API process** — `shared/queue/queue.ts` registers them as an import side-effect, and `app.ts` imports it. Job processing therefore competes with request handling for the same event loop, and restarting the API restarts the workers.
  * Increase the concurrency option on BullMQ workers:
    ```typescript
    new Worker('email', emailHandler, { connection, concurrency: 5 })
    ```
  * Extracting workers into a separate process/container is the higher-value change, and is a prerequisite for scaling them independently of HTTP traffic.

---

## 21.4 File Storage — the blocking constraint

File uploads are written to local disk under `DISK_MOUNT_PATH`. A Render Persistent Disk, or a single EBS volume, **cannot be attached to more than one instance**, so the API is pinned to a single replica.

Migrating to object storage (S3 or equivalent) fronted by a CDN is the prerequisite for every other form of horizontal scaling. The change is contained: `shared/utils/fileStorage.ts` is the only module that touches the filesystem, and its existing HMAC signed-URL layer maps cleanly onto S3 presigned URLs, so the `/files` route and all call sites can stay as they are.

---

## 21.5 Known bottlenecks in current code

Worth fixing before, or alongside, any scaling work:

* **`jobExpiry` cleanup loads every approved and pending job into memory** and iterates them in a loop with a per-row `update`. Fine at current volume, linear cost as job count grows. (It also never runs today — see the scheduler note in [OPERATIONS_RUNBOOK.md](OPERATIONS_RUNBOOK.md).)
* **Digest compilation queries every candidate profile** with its user record, then enqueues one email job per candidate. This will need batching and pagination well before it reaches tens of thousands of users.
* **Images are stored unoptimized** — no resize or recompression step, so bandwidth and disk grow faster than necessary. Adding `sharp` to `fileStorage.ts` addresses it.
* **Three declared queues (`notifications`, `audit`, `reports`) have no workers**, so anything enqueued to them accumulates in Redis indefinitely and consumes memory without ever being processed.

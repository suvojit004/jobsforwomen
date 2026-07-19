# 21. Scaling Guide

This guide details the architectural plans for scaling the platform as user volume and traffic grow.

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
* Integrate the official **`@socket.io/redis-adapter`** into the backend.
* When a message or notification is emitted on Server Node A, the Redis adapter publishes it to a Redis pub/sub channel.
* All other server nodes receive the publish and emit it to sockets connected to their instances.
* Configure sticky sessions on your load balancer (e.g., NGINX, AWS ALB) to ensure client sockets route consistently to the same server node.

---

## 21.3 Caching & Queue Optimization

* **Redis Clustering**: Replace the single Upstash Redis instance with a cluster to scale memory capacity and write throughput.
* **BullMQ Concurrency**:
  * Currently, the background workers run in a single thread.
  * Increase the concurrency option on BullMQ workers:
    ```typescript
    new Worker('email', emailHandler, { connection, concurrency: 5 })
    ```
  * Run workers in separate dedicated containers to decouple queue processing from HTTP request handlers.
* **Static Assets CDN**: Offload heavy asset loading (like profiles, resumes, and company logos) by routing them through Cloudinary CDNs with caching rules.

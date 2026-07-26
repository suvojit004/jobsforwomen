# 25. Future Roadmap

This roadmap outlines recommended improvements to scale, secure, and expand the platform.

---

## 25.1 Short-Term Improvements (1 - 3 Months)

* **Cache Optimization**: Implement Redis caching for static lists (such as departments and industries) to reduce PostgreSQL read queries.
* **Typing Indicator Enhancements**: Standardize real-time typing indicators in chat modules using socket events.
* **Unified State Mappers**: Refactor duplicate profile mapping utilities inside candidates folder into a shared frontend library.

---

## 25.2 Medium-Term Improvements (3 - 6 Months)

* **Push Notification Subscriptions**: Complete service worker routing integration to enable native browser push alerts.
* **Antivirus Scanning Node**: Integrate a live file scanner (like ClamAV or VirusTotal API). Uploads are currently validated only structurally (magic-byte vs declared MIME type) — there is **no malware scanning** today.
* **Multi-Factor Authentication**: Wire TOTP-based authentication (such as Google Authenticator) for Admin and Recruiter logins.

---

## 25.3 Long-Term & Enterprise Improvements (6+ Months)

* **Horizontal Sockets Scaling**: Configure `@socket.io/redis-adapter` to distribute WebSocket events across multiple server nodes.
* **Microservices Partition**:
  * Decouple the BullMQ worker tasks from the API server and deploy them as separate microservices.
  * Extract the messaging service into a standalone Node/Go WebSocket cluster.
* **Analytics Engine**: Implement a data processing worker to generate dashboard conversion insights (e.g., job application conversion rates) without query overhead on PostgreSQL.

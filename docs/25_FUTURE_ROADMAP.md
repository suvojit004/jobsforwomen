# 25. Future Roadmap

This roadmap outlines recommended improvements to scale, secure, and expand the platform.

---

## 25.1 Short-Term Improvements (1 - 3 Months)

* **Cache Optimization**: Implement Redis caching for static lists (such as departments and industries) to reduce PostgreSQL read queries.
* **Typing Indicator Enhancements**: Standardize real-time typing indicators in chat modules using socket events.
* **Unified State Mappers**: Refactor duplicate profile mapping utilities inside candidates folder into a shared frontend library.

---

## 25.2 Medium-Term Improvements (3 - 6 Months)

* **Push Notification Subscriptions**: Complete service worker routing integration to enable native browser push alerts. (The `push_notifications` feature flag was retired/de-seeded rather than left as a pending toggle — see [12. Admin Module](12_ADMIN_MODULE.md) §12.4 — since nothing branches on it yet.)
* **Antivirus Scanning Node**: Integrate a live file scanner (like ClamAV or VirusTotal API). Uploads are currently validated only structurally (magic-byte vs declared MIME type) — there is **no malware scanning** today.
* ~~**Multi-Factor Authentication**: Wire TOTP-based authentication...~~ **Already done.** Per-user opt-in TOTP (RFC 6238), QR-code enrollment, encrypted secret storage, and a login-time challenge are fully implemented across all three roles — see `backend/src/shared/utils/twoFactor.ts` and [12. Admin Module](12_ADMIN_MODULE.md) §12.4. What remains open, if wanted: an *enforced* MFA mode (the retired `mfa_enforced` flag would require it platform-wide rather than leaving it opt-in) — nothing currently checks that flag.
* **Real-time chat/messaging**: previously implemented, then removed from the app (see [6. Backend](06_BACKEND.md) §6.3) — the `Conversation`/`Message`/`ConversationParticipant` tables remain in the schema, dormant. Reintroducing candidate↔recruiter chat, if wanted, would mean rebuilding the socket handlers and routes rather than un-deleting a flag.

---

## 25.3 Long-Term & Enterprise Improvements (6+ Months)

* ~~**Horizontal Sockets Scaling**: Configure `@socket.io/redis-adapter`...~~ **Already done.** The Redis adapter is attached at boot in `shared/socket/socket.ts` with a graceful in-memory fallback — see [21. Scaling](21_SCALING.md) §21.2. What remains for *actual* multi-instance operation is the file-storage constraint in §21.4 below (a single persistent disk still pins the API to one instance) and configuring sticky sessions / connection-draining on whatever load balancer sits in front of more than one instance.
* **Microservices Partition**:
  * Decouple the BullMQ worker tasks from the API server and deploy them as separate microservices.
  * Extract the messaging service into a standalone Node/Go WebSocket cluster.
* **Analytics Engine**: Implement a data processing worker to generate dashboard conversion insights (e.g., job application conversion rates) without query overhead on PostgreSQL.

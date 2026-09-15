# 24. Complete Feature Matrix

This matrix lists the implementation status of core system capabilities across the stack.

---

## 24.1 Platform Feature Matrix

| Feature | Implemented | Partial | Frontend | Backend | API | Database | Production Ready | Notes |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :--- |
| **JWT Access / Refresh Auth** | Yes | - | Yes | Yes | Yes | Yes | Yes | Uses secure HttpOnly session cookies. |
| **Google OAuth Integration** | Yes | - | Yes | Yes | Yes | Yes | Yes | Integrates directly with standard Google Cloud OAuth. |
| **Colleague Team Invites** | Yes | - | Yes | Yes | Yes | Yes | Yes | Uses single-use 48-hour secure tokens. |
| **Company Verification** | Yes | - | Yes | Yes | Yes | Yes | Yes | Controlled by Admin panel. |
| **Job Posting Lifecycle** | Yes | - | Yes | Yes | Yes | Yes | Yes | Approvals required from Admin before visibility. |
| **Real-time Notifications** | Yes | - | Yes | Yes | Yes | Yes | Yes | Delivered via Sockets and Email. |
| **Real-time Chat Messaging** | - | - | No | No | No | Dormant | No | **Removed from the app.** No socket handlers, no routes, no frontend UI remain. `Conversation`/`Message`/`ConversationParticipant` tables still exist but are unused — see [5. Database](05_DATABASE.md) and [6. Backend](06_BACKEND.md) §6.3. |
| **Candidate Resume Upload** | Yes | - | Yes | Yes | Yes | Yes | Yes | Local disk storage with signed, time-limited URLs. |
| **Interactive Job Filters** | Yes | - | Yes | Yes | Yes | Yes | Yes | Filter by progressive benefit tags. |
| **Feature Configuration Flags** | Yes | - | Yes | Yes | Yes | Yes | Yes | Managed dynamically from Admin view. |
| **Audit Activity Logs** | Yes | - | Yes | Yes | Yes | Yes | Yes | Stores before/after changes. |
| **System Diagnostics Health** | Yes | - | Yes | Yes | Yes | Yes | Yes | Verifies Redis, Postgres, disk writability, queues, email. |
| **Push Notifications** | - | Yes | Yes | No | No | No | No | Flag retired (no longer seeded/surfaced) since no push delivery mechanism was ever built — see [12. Admin Module](12_ADMIN_MODULE.md) §12.4. |
| **Two-Factor Authentication**| Yes | - | Yes | Yes | Yes | Yes | Yes | **Fully implemented**, not a mockup: real RFC 6238 TOTP (own implementation on Node's `crypto`, no third-party TOTP library), QR-code enrollment, encrypted-at-rest secrets, and a pending-token login challenge. Per-user opt-in from each role's own Settings page — not gated by a feature flag. See `backend/src/shared/utils/twoFactor.ts` and `auth.routes.ts` (`/2fa/enroll/start`, `/2fa/enroll/confirm`, `/2fa/verify`, `/2fa/disable`). |
| **Advanced Conversion Analytics**| - | Yes | Yes | No | No | No | No | Flag retired (no longer seeded/surfaced) since nothing in the codebase ever branched on it — see [12. Admin Module](12_ADMIN_MODULE.md) §12.4. |

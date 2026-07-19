# 7. Frontend Documentation

The frontend is a single-page application (SPA) built using React 18, TypeScript, and Vite. It compiles cleanly with zero TypeScript errors.

---

## 7.1 Pages, Layouts, & Routes

The client-side router is defined in `frontend/src/routes/AppRouter.tsx` using `react-router-dom`:

* **`AppRouter`**: Declares root paths and splits authenticated users into sub-routers:
  * **Candidate Routes (`CandidateRoutes.tsx`)**: Mapped under `/candidate`. Mounts `CandidateLayout` and includes `/candidate/dashboard`, `/candidate/profile`, `/candidate/jobs`, and `/candidate/notifications`.
  * **Recruiter Routes (`RecruiterRoutes.tsx`)**: Mapped under `/recruiter`. Mounts `RecruiterLayout` and includes `/recruiter/dashboard`, `/recruiter/company-profile`, `/recruiter/post-job`, `/recruiter/manage-jobs`, `/recruiter/team`, and `/recruiter/notifications`.
  * **Admin Routes (`AdminRoutes.tsx`)**: Mapped under `/admin`. Mounts `AdminLayout` and includes `/admin/dashboard`, `/admin/user-moderation`, `/admin/job-moderation`, `/admin/company-approvals`, and `/admin/notifications`.
* **Layouts**: Layout wrappers (`AdminLayout.tsx`, `CandidateLayout.tsx`, `RecruiterLayout.tsx`) provide the structural dashboard interface (sidebar menus, header navigation, notification bell icons). They wrap their children in a unified `NotificationProvider` to share notification badges and trigger events.

---

## 7.2 Core Contexts & State Management

The frontend utilizes React Contexts for global state management:

1. **`AuthContext` (`AuthContext.tsx`)**:
   * Manages authentication states: active user metadata, token lifecycle, and authentication status.
   * Exposes methods: `login`, `register`, `logout`, and session-expiry handlers.
   * Persists access tokens in-memory and handles local storage checks for session re-validation.
2. **`NotificationContext` (`NotificationContext.tsx`)**:
   * Role-aware context. Detects active user roles (Candidate, Recruiter, or Admin) and queries the correct api helper.
   * Establishes real-time namespace connections with the backend Socket.IO server.
   * Manages unified states for notifications, unread counters, and optimistic UI updates for marking alerts read or dismissed.

---

## 7.3 Reusable API Client (`apiClient`)

The API client (`frontend/src/api/client.ts`) is a custom Fetch-based wrapper containing interceptors:

* **Authorization Headers**: Automatically attaches `Authorization: Bearer <accessToken>` headers to outbound requests if a token is present in the in-memory state.
* **Multipart Stream Support**: Omits the default JSON `Content-Type` header when sending `FormData` payloads (required for uploading company logos or candidate resumes).
* **Token Refresh Interceptor**:
  * If a request fails with an HTTP `401 Unauthorized` status (due to a stale access token), the client halts requests and calls `/api/v1/auth/refresh` to fetch a new token.
  * If the token refresh succeeds, it updates the in-memory token, calls `updateSocketToken()` to synchronize the live Socket.IO connection, and retries the original request.
  * If the refresh attempt fails (e.g., the refresh token is expired or revoked), it calls `handleSessionExpired()`, clearing storage, cleanly disconnecting socket instances, and redirecting the browser to `/auth/login`.

---

## 7.4 Styling System & Tokens

* **CSS Architecture**: Employs vanilla CSS in `/src/index.css` and `/src/styles/` combined with Tailwind CSS classes for layout structures.
* **Color Palette**: Uses HSL color tokens (e.g., custom violet values `#6B2C91` and pink highlights) for custom styling.
* **Typography**: Uses modern sans-serif typefaces (like Inter and Outfit) imported from Google Fonts instead of default system web options.
* **Framer Motion Animations**: Implements interactive cards that float upwards on hover (`whileHover={{ y: -4, scale: 1.02 }}`) and slide-out exits for dismissed cards.
* **Stale Deployment Safety**: The `ErrorBoundary` component intercepts chunk-loading errors ("Failed to fetch dynamically imported module", MIME-type script errors) and automatically performs a safe reload to download new assets, using sessionStorage flags to prevent infinite reload loops.

# 23. Dependency Documentation

This document audits the libraries and dependencies configured in the backend and frontend package definitions.

---

## 23.1 Backend Dependencies (`backend/package.json`)

### Core Runtime:
* **`express`**: Routing and HTTP request pipeline framework.
* **`@prisma/client`** & **`prisma`**: Database ORM used to manage schema mutations, SQL mappings, and queries.
* **`bcrypt`**: Blowfish-based password hashing library.
* **`jsonwebtoken`**: Creates and validates JWT access and refresh signatures.
* **`zod`**: Schema validation library used for parsing environment variables and endpoint payloads.
* **`socket.io`**: Real-time WebSocket server (notifications only today — real-time chat was removed from the app; see [6. Backend](06_BACKEND.md) §6.3).
* **`@socket.io/redis-adapter`**: Cross-instance Socket.IO event fanout over Redis pub/sub. Currently latent (single-instance deployment) but required the moment a second instance exists.
* **`bullmq`**: Redis-backed queue system for running background operations (such as mailing campaigns and cleanup tasks).
* **`ioredis`**: Redis client engine used by BullMQ and caching utilities.
* **`@aws-sdk/client-sesv2`**: Official AWS SDK client for SES v2, used for all transactional email.
* **`multer`**: Multipart form data parser for file uploads. Files are written to local disk by `shared/utils/fileStorage.ts` (no third-party storage SDK is used).
* **`helmet`**: Secure HTTP headers configuration middleware.
* **`cors`**: Express CORS policy manager.
* **`winston`**: Robust logging utility.

---

## 23.2 Frontend Dependencies (`frontend/package.json`)

### Core Framework:
* **`react`** & **`react-dom`**: UI rendering framework (React 19).
* **`react-router-dom`**: Client-side single-page routing client.
* **`socket.io-client`**: Client-side Socket.IO listener (real-time notifications only — see the backend note above).
* **`@tanstack/react-query`**: Server-state data fetching, caching, and refetch management for API calls.
* **`@reduxjs/toolkit`** & **`react-redux`**: Global client-side state management.
* **`react-hook-form`** & **`@hookform/resolvers`**: Form state and validation, wired to `zod` schemas via the resolver.
* **`zod`**: Shared schema validation library (also used on the backend — see above), used here for form and payload validation.
* **`axios`**: HTTP client underlying the hand-rolled API client described in [7. Frontend](07_FRONTEND.md) §7.3.
* **`radix-ui`** & **`shadcn`**: Unstyled/accessible primitive components and the CLI/registry conventions built on top of them, underlying the component library in [15. UI Component Library](15_UI_COMPONENT_LIBRARY.md).
* **`framer-motion`**: Animation engine.
* **`lucide-react`**: Vector icons pack.
* **`sonner`**: Clean, accessible toast alert notifier.
* **`qrcode`**: Generates the QR code rendered during two-factor authentication enrollment (see [12. Admin Module](12_ADMIN_MODULE.md) §12.4 and [9. Authentication](09_AUTHENTICATION.md)).
* **`next-themes`**: Light/dark theme switching.
* **`clsx`**, **`tailwind-merge`**, **`class-variance-authority`**: Utility helpers for conditional/variant CSS class composition.
* **`tw-animate-css`**: Preconfigured animations for widgets.

---

## 23.3 Library Upgrades & Compatibility

* **Node.js**: Kept locked at Node `v22.x` to prevent native C++ binding compilation errors (specifically with `bcrypt`).
* **Package Updates**: When updating backend packages, ensure that Prisma ORM schemas (`prisma generate`) are recompiled to prevent client query errors.

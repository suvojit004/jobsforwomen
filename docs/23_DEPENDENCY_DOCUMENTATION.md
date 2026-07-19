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
* **`socket.io`**: Real-time WebSocket server.
* **`bullmq`**: Redis-backed queue system for running background operations (such as mailing campaigns and cleanup tasks).
* **`ioredis`**: Redis client engine used by BullMQ and caching utilities.
* **`resend`**: Official Node.js SDK used for sending transactional emails.
* **`cloudinary`**: Cloud storage manager for candidate resumes and recruiter logos.
* **`multer`**: Multipart form data parser for file uploads.
* **`helmet`**: Secure HTTP headers configuration middleware.
* **`cors`**: Express CORS policy manager.
* **`winston`**: Robust logging utility.

---

## 23.2 Frontend Dependencies (`frontend/package.json`)

### Core Framework:
* **`react`** & **`react-dom`**: UI rendering framework.
* **`react-router-dom`**: Client-side single-page routing client.
* **`socket.io-client`**: Client-side Socket.IO listener.
* **`framer-motion`**: Animation engine.
* **`lucide-react`**: Vector icons pack.
* **`sonner`**: Clean, accessible toast alert notifier.
* **`clsx`** & **`tailwind-merge`**: Utility helpers for conditional CSS class merging.
* **`tailwind-animate`**: Preconfigured animations for widgets.

---

## 23.3 Library Upgrades & Compatibility

* **Node.js**: Kept locked at Node `v22.x` to prevent native C++ binding compilation errors (specifically with `bcrypt`).
* **Package Updates**: When updating backend packages, ensure that Prisma ORM schemas (`prisma generate`) are recompiled to prevent client query errors.

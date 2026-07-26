# 3. Installation Guide

This guide details setting up the development workspace for both the backend and frontend services.

---

## 3.1 Prerequisites

Ensure you have the following installed on your system:
* **Node.js**: `v22.x` (Targeted Node version defined in `package.json`).
* **Package Manager**: `npm v10+` (bundled with Node).
* **Databases**:
  * **PostgreSQL**: `v15+` (Local server or Cloud database instance).
  * **Redis**: `v6+` (For BullMQ queue management and authentication caches).
* **External API Accounts**:
  * **Resend**: API key for transactional emails.
  * **Google Cloud Console**: Project setup for Google OAuth login.

---

## 3.2 Workspace Installation Setup

### Step 1: Clone the Repository
Clone the project locally and navigate to the directory:
```bash
git clone https://github.com/Rks052004/JobsForWomen.git
cd JobsForWomen
```

### Step 2: Configure Backend Environment Variables
Navigate to the `backend/` directory, copy the template `.env.example`, and fill in the values:
```bash
cd backend
cp .env.example .env
```
Update `.env` with your database credentials, Redis URL, storage path (`DISK_MOUNT_PATH`), and Resend settings. (See [4. Environment Variables](04_ENVIRONMENT_VARIABLES.md) for full details).

### Step 3: Install Backend Dependencies
Install backend Node packages:
```bash
npm install
```

### Step 4: Run Prisma Database Migrations
Initialize the PostgreSQL schema and apply database migrations:
```bash
npx prisma generate
npx prisma migrate dev --name init
```

### Step 5: Seed the Database
Seed the database with default roles, permissions, department lists, and the default Super Admin login:
```bash
npm run seed
```
*(Default Super Admin: Email `admin@jobsforwomen.info` | Password `admin123`)*

> **Security:** these are development-only bootstrap credentials created by the seed script. **Change the password or delete this account before any environment is publicly reachable.**

### Step 6: Configure Frontend Environment Variables
Navigate to the `frontend/` directory, copy the template environment configuration, and specify the local API server URL:
```bash
cd ../frontend
cp .env.example .env
```
Ensure `VITE_API_URL` is pointing to the Express server (defaults to `http://localhost:5000`).

### Step 7: Install Frontend Dependencies
```bash
npm install
```

---

## 3.3 Running the Application

### Running Backend in Development Mode:
Navigate to the `backend/` directory and execute:
```bash
cd backend
npm run dev
```
The Express API server starts listening at `http://localhost:5000`.

### Running Frontend in Development Mode:
Navigate to the `frontend/` directory and execute:
```bash
cd frontend
npm run dev
```
The Vite development server boots, typically hosting the UI at `http://localhost:3000` (or `http://localhost:5173`).

---

## 3.4 Common Installation Issues & Fixes

### Issue 1: BullMQ fails due to missing Redis Connection
* **Symptom**: Process crashes on start with `Error: Connection refused` or `Redis connection failed`.
* **Fix**: Ensure the Redis server is running locally (e.g., `sudo service redis-server start` on Linux) or verify the `REDIS_URL` in `.env` is correct.

### Issue 2: Prisma Studio Client Mismatch
* **Symptom**: Running `npx prisma studio` from the root workspace requests installing the latest Prisma packages (e.g., `7.8.0`), whereas the project uses `6.19.3`.
* **Fix**: Always navigate inside the `backend/` directory before executing prisma commands. Running `cd backend && npx prisma studio` ensures the local version in `node_modules` is executed.

### OS-Specific Guidelines:
* **Windows**: Run PowerShell as Administrator if you face file lock/permission errors installing `node-gyp` or Native Addons (like `bcrypt`). Alternatively, use WSL2.
* **macOS / Linux**: If compiling native Node binary modules fails, verify you have compilation tools installed (`build-essential` on Debian/Ubuntu or Xcode command-line tools on macOS).

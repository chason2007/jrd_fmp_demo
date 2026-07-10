# Audit Portal — Backend

Secure Node + Express + Prisma + MySQL API for the audit platform. Built from scratch.
Current state: **Auth module** (login / refresh / logout / me) with RBAC scaffolding.

## Stack
- Express (HTTP), Prisma (MySQL access), Argon2id (password hashing)
- JWT access tokens (15 min, in-memory on the client) + rotating refresh tokens
  (HttpOnly/Secure/SameSite=Strict cookie, single-use, family reuse-detection)
- Zod (validation), Helmet (security headers), express-rate-limit + DB-backed brute-force guard

## Project layout
```
prisma/
  schema.prisma     # DB schema (auth tables for now)
  seed.js           # creates the bootstrap admin (Argon2id)
src/
  config/env.js     # validates environment at boot (fail-fast)
  lib/              # prisma client, tokens, audit log, brute-force guard
  middleware/       # auth (requireAuth/requireRole), validate, rate limit, errors
  utils/            # HttpError, asyncHandler, cookie helpers
  validation/       # Zod schemas
  controllers/      # authController
  routes/           # authRoutes
  server.js         # app bootstrap
```

## Setup (first time)
1. **Install MySQL** (Community Server) and create the database + an app user:
   ```sql
   CREATE DATABASE audit_portal CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   CREATE USER 'audit_app'@'localhost' IDENTIFIED BY 'a-strong-password';
   GRANT SELECT, INSERT, UPDATE, DELETE ON audit_portal.* TO 'audit_app'@'localhost';
   ```
   (The app account intentionally has **no** CREATE/DROP/GRANT — migrations are run by you, a privileged user.)
2. `cp .env.example .env` and fill in `DATABASE_URL`, `JWT_ACCESS_SECRET` (`openssl rand -hex 32`), and `DEFAULT_ADMIN_PASS`.
3. `npm install`
4. `npx prisma migrate dev --name init_auth`   # creates the tables
5. `npm run seed`                              # creates the admin user
6. `npm run dev`                               # starts on http://localhost:3000

## Endpoints
| Method | Path                | Auth        | Purpose |
|--------|---------------------|-------------|---------|
| GET    | `/api/health`       | none        | Liveness check |
| POST   | `/api/auth/login`   | none        | Issue access token + set refresh cookie |
| POST   | `/api/auth/refresh` | cookie      | Rotate refresh, issue new access token |
| POST   | `/api/auth/logout`  | cookie      | Revoke session family, clear cookie |
| GET    | `/api/auth/me`      | access JWT  | Current user + role |

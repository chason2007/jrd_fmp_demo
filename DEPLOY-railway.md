# Deploy to Railway (recommended for the beta)

One place hosts the app + MySQL + file storage. Railway reads `nixpacks.toml`,
installs both apps, builds the frontend, runs migrations, and starts the backend
(which serves the built React app same-origin). HTTPS is automatic — no Docker.

## 0. Accounts
- GitHub (repo `chason2007/jrd_portal` — already pushed).
- Railway account at railway.app (sign up with GitHub; trial credit, then ~usage-based).

## 1. Create the project
Railway → **New Project → Deploy from GitHub repo → jrd_portal**.
It starts building immediately. The first build will fail until the DB + env vars
exist (steps 2–4) — that's expected.

## 2. Add MySQL
In the project canvas → **New → Database → Add MySQL**. Railway provisions it and
exposes its connection variables.

## 3. Add a Volume (REQUIRED — photos/PDFs live on disk)
On the **app service → Settings → Volumes → New Volume**, mount path:
```
/app/backend/storage
```
Without this, uploaded photos and generated PDFs are wiped on every redeploy.

## 4. Environment variables (app service → Variables)
| Variable | Value |
|---|---|
| `DATABASE_URL` | Reference the DB: type `${{` and pick **MySQL.MYSQL_URL** |
| `JWT_ACCESS_SECRET` | fresh 64-char — `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `NODE_ENV` | `production` |
| `TRUST_PROXY` | `1` (Railway sits behind one proxy) |
| `DEFAULT_ADMIN_USER` | your superadmin login |
| `DEFAULT_ADMIN_PASS` | a STRONG password — change after first login |
| `COOKIE_DOMAIN` | leave **blank** |
| `MAX_UPLOAD_MB` | `8` (optional) |

Leave `COOKIE_SAMESITE`, `CORS_ORIGINS`, `ACCESS_TOKEN_TTL`,
`REFRESH_TOKEN_TTL_DAYS`, `UPLOAD_DIR` at defaults — this is a same-origin deploy
(the backend serves the SPA), so no CORS and the default `strict` cookie is correct.

## 5. Generate a public URL
App service → **Settings → Networking → Generate Domain** → a
`*.up.railway.app` URL with HTTPS (required — the session cookie is `Secure`).

## 6. Deploy
Redeploy with the vars set. The start command automatically runs:
`prisma migrate deploy` (creates all 17 tables) → seed (creates the admin) →
start server. Watch the deploy logs for `API listening`.

## 7. Verify
1. Open the URL → login screen.
2. Log in with `DEFAULT_ADMIN_USER` / `DEFAULT_ADMIN_PASS`.
3. **Refresh the page** — you should stay logged in.
4. **Change the admin password immediately** (or create real users).
5. Upload a photo + open a report to confirm the Volume works.

## Day-to-day
- **Redeploy** = `git push` (Railway auto-deploys `main`).
- Migrations run automatically each deploy (`migrate deploy` is idempotent).
- The seed skips if any user already exists.

## Moving to Azure later
The build/start steps in `nixpacks.toml` map directly to an Azure App Service
(build command + startup command) or a VM. Azure Database for MySQL replaces the
Railway MySQL; an Azure Files mount or Blob storage replaces the Volume.
```

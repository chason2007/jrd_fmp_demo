# Deploy: Vercel (frontend) + Render (backend)

A cross-origin split: the React app on Vercel talks to the Node/Express API on
Render. Because the two live on **different domains**, a few settings MUST be
right or auth silently breaks — those are called out with ⚠️.

## Two things Render does NOT give you (plan for these first)
1. **No managed MySQL.** Render only offers Postgres. You need an **external
   MySQL 8** — e.g. **Aiven for MySQL** (has a small free/trial tier). Avoid
   PlanetScale unless you're ready to change the schema: it has no foreign keys,
   and this app relies on FK `onDelete` rules.
2. **No persistent disk on the free tier.** Photos + PDFs are written to local
   disk. On Render's **free** web service the disk is wiped on every deploy *and*
   the service sleeps after 15 min. To keep uploads you need a **paid Starter
   instance ($7/mo) with a Disk** (below), or the files won't survive.

---

## Step 1 — Provision MySQL (external)
Create a MySQL 8 database (e.g. Aiven). Copy its connection string:
```
mysql://USER:PASSWORD@HOST:PORT/DBNAME?ssl-mode=REQUIRED
```
The user must have DDL rights (managed providers give a full-privilege user) so
`prisma migrate deploy` can create the tables.

## Step 2 — Deploy the backend on Render
Render → **New → Web Service → connect the GitHub repo**.

| Setting | Value |
|---|---|
| Root Directory | `backend` |
| Runtime | Node |
| Build Command | `npm ci && npx prisma generate` |
| Start Command | `npx prisma migrate deploy && node prisma/seed.js && node src/server.js` |
| Instance Type | **Starter (paid)** if you want photos to persist (needs a Disk) |

**Add a Disk** (Starter+): Settings → Disks → Add Disk, mount path:
```
/opt/render/project/src/backend/storage
```
(The app writes `storage/uploads` and `storage/pdf_reports` under its working
directory, which is the `backend` root at runtime.)

**Environment variables** (Render → Environment):
| Variable | Value |
|---|---|
| `DATABASE_URL` | your external MySQL URL from step 1 |
| `JWT_ACCESS_SECRET` | fresh 64-char — `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `NODE_ENV` | `production` |
| `TRUST_PROXY` | `1`  (Render sits behind one proxy) |
| ⚠️ `COOKIE_SAMESITE` | `none`  (REQUIRED for cross-origin — without it the refresh cookie is never sent and users get logged out on refresh) |
| `COOKIE_DOMAIN` | leave **blank** |
| ⚠️ `CORS_ORIGINS` | your Vercel URL (set after step 3, e.g. `https://audit-portal.vercel.app`) |
| `DEFAULT_ADMIN_USER` | your superadmin login |
| `DEFAULT_ADMIN_PASS` | a STRONG password — change after first login |
| `MAX_UPLOAD_MB` | `8` (optional) |

Deploy. Note the backend URL, e.g. `https://audit-portal-api.onrender.com`.
(The bundled SPA-serving is auto-skipped here since there's no frontend build —
this stays API-only.)

## Step 3 — Deploy the frontend on Vercel
Vercel → **Add New → Project → import the repo**.

| Setting | Value |
|---|---|
| Root Directory | `frontend` |
| Framework Preset | Vite (auto-detected) |
| Build Command | `npm run build` (default) |
| Output Directory | `dist` (default) |
| ⚠️ Env var `VITE_API_URL` | your Render backend URL from step 2 (baked in at build — redeploy if it changes) |

Deploy. Note the Vercel URL, e.g. `https://audit-portal.vercel.app`.

## Step 4 — Close the loop (CORS)
Go back to Render → set `CORS_ORIGINS` to the exact Vercel URL from step 3 →
redeploy the backend. (Chicken-and-egg: backend first for its URL, then Vercel,
then point the backend's CORS at Vercel.)

## Step 5 — Verify
1. Open the Vercel URL → login screen.
2. Log in with `DEFAULT_ADMIN_USER` / `DEFAULT_ADMIN_PASS`.
3. **Refresh the page** — you should stay logged in. If you get bounced to login,
   `COOKIE_SAMESITE=none` or `CORS_ORIGINS` is wrong.
4. **Immediately change the admin password** (or create real users).
5. Upload a photo + open a report to confirm the Disk works.

## The split's failure modes (memorize these)
| Symptom | Cause |
|---|---|
| Login works, then logged out on refresh | `COOKIE_SAMESITE` not `none`, or no HTTPS |
| Browser console CORS errors / requests blocked | `CORS_ORIGINS` ≠ exact Vercel URL |
| Frontend calls `localhost:3000` in prod | `VITE_API_URL` not set at build → rebuild |
| Photos vanish after a redeploy | free Render (no Disk) → use Starter + Disk |
| Rate limiting misbehaves / wrong IPs | `TRUST_PROXY` not `1` |

## Cost reality
Vercel frontend: free tier is fine. Render backend: **$7/mo Starter** (needed for
the persistent disk). External MySQL: free/trial tier for beta. Compare with
Railway, which bundles MySQL + volume + app in one place — fewer moving parts for
a temporary beta.

# Deploying to your own server

Self-hosted, native Node — no third-party PaaS, no Docker required. The backend
serves the built React app, so you run **one** Node process behind a reverse
proxy (nginx) that terminates HTTPS.

Target assumed below: a Linux server (Ubuntu/Debian) you control. Adapt paths for
other distros.

## Architecture
```
Internet ──HTTPS──▶ nginx (reverse proxy, TLS) ──HTTP──▶ Node backend :3000
                                                          └─ serves frontend/dist
                                                          └─ /api/*  API
MySQL (local)  ◀── backend
storage/uploads (local disk) ◀── backend   (photos + PDFs — MUST be backed up)
```

## 1. Prerequisites (install once on the server)
- **Node.js 20+** (22 recommended)
- **MySQL 8** (Community Server)
- **nginx**
- **git**
- A process manager to keep Node running + restart on boot — **pm2** or a
  **systemd** unit (systemd option below).

## 2. Get the code onto the server
```bash
git clone <your-repo-url> /opt/audit-portal
cd /opt/audit-portal
```

## 3. Create the database + least-privilege app user
Run as a privileged MySQL user (e.g. root):
```sql
CREATE DATABASE audit_portal CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'audit_app'@'localhost' IDENTIFIED BY 'a-strong-password';
GRANT SELECT, INSERT, UPDATE, DELETE ON audit_portal.* TO 'audit_app'@'localhost';
FLUSH PRIVILEGES;
```
The app account has **no** CREATE/DROP/GRANT on purpose — migrations are run by
you with a privileged account (step 5).

## 4. Configure environment
```bash
cp backend/.env.example backend/.env
```
Edit `backend/.env`:

| Variable | Production value |
|---|---|
| `DATABASE_URL` | `mysql://audit_app:<password>@localhost:3306/audit_portal` |
| `JWT_ACCESS_SECRET` | fresh 64-char secret — `openssl rand -hex 32` |
| `NODE_ENV` | `production` |
| `PORT` | `3000` (or whatever nginx proxies to) |
| `TRUST_PROXY` | `1` (you run behind one nginx proxy — required so real client IPs reach rate-limiting) |
| `DEFAULT_ADMIN_USER` | your superadmin login |
| `DEFAULT_ADMIN_PASS` | a STRONG password — change it right after first login |
| `COOKIE_DOMAIN` | leave blank/unset (host-only cookie is correct for a single domain) |
| `CORS_ORIGINS` | leave blank (backend serves the SPA same-origin) |
| `MAX_UPLOAD_MB` | `8` (optional) |

`ACCESS_TOKEN_TTL`, `REFRESH_TOKEN_TTL_DAYS`, `UPLOAD_DIR` can stay at defaults.
Keep `backend/.env` readable only by the app user: `chmod 600 backend/.env`.

> **HTTPS is required in production** — the refresh-token cookie is `Secure`, so
> it will not be sent over plain HTTP and login will silently fail. Do step 8
> before expecting login to work.

## 5. Install, build, migrate, seed
```bash
# Backend deps
npm --prefix backend ci
# Frontend deps + production build (backend serves the output)
npm --prefix frontend ci
npm --prefix frontend run build

cd backend
npx prisma generate
npx prisma migrate deploy   # creates all tables (run as your privileged DB user if the app user lacks DDL)
node prisma/seed.js         # creates the bootstrap admin (idempotent — skips if users exist)
```

> `prisma migrate deploy` needs DDL rights. Either run it with a privileged
> `DATABASE_URL` temporarily, or grant the app user DDL only for the migration
> and revoke after.

## 6. Run the backend under a process manager

**Option A — pm2**
```bash
npm i -g pm2
cd /opt/audit-portal/backend
pm2 start src/server.js --name audit-portal
pm2 save
pm2 startup   # follow the printed command so it restarts on reboot
```

**Option B — systemd** (`/etc/systemd/system/audit-portal.service`)
```ini
[Unit]
Description=Audit Portal API
After=network.target mysql.service

[Service]
Type=simple
User=audit
WorkingDirectory=/opt/audit-portal/backend
ExecStart=/usr/bin/node src/server.js
Restart=always
RestartSec=5
EnvironmentFile=/opt/audit-portal/backend/.env

[Install]
WantedBy=multi-user.target
```
```bash
sudo systemctl daemon-reload
sudo systemctl enable --now audit-portal
sudo journalctl -u audit-portal -f   # watch logs; look for "API listening"
```

## 7. nginx reverse proxy
`/etc/nginx/sites-available/audit-portal`:
```nginx
server {
    listen 80;
    server_name audit.example.com;   # your domain

    client_max_body_size 25m;        # >= Velora's 20mb JSON + headroom

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```
```bash
sudo ln -s /etc/nginx/sites-available/audit-portal /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```
`TRUST_PROXY=1` in `.env` must match this single proxy hop.

## 8. HTTPS (Let's Encrypt)
```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d audit.example.com
```
Certbot edits the nginx config for TLS and sets up auto-renewal. Confirm the site
loads over `https://`.

## 9. Verify
1. Open `https://audit.example.com` → login screen.
2. Log in with `DEFAULT_ADMIN_USER` / `DEFAULT_ADMIN_PASS`.
3. **Immediately** change that password (or create real accounts and disable the bootstrap one).
4. Do one photo upload + report to confirm `storage/uploads` is writable.

## Day-to-day: deploying updates
```bash
cd /opt/audit-portal
git pull
npm --prefix backend ci
npm --prefix frontend ci && npm --prefix frontend run build
cd backend && npx prisma migrate deploy
pm2 restart audit-portal        # or: sudo systemctl restart audit-portal
```
Migrations are idempotent; the seed skips when any user already exists.

## Operational must-dos (see readiness notes)
- **Back up the database + `backend/storage/`** — use `scripts/backup.sh` (dumps
  MySQL + tars storage, gzips, prunes old copies; set `BACKUP_PASSPHRASE` to
  encrypt). Schedule via cron, then **sync `backups/` off this server**:
  ```
  30 2 * * *  cd /opt/audit-portal && ./scripts/backup.sh >> /var/log/audit-backup.log 2>&1
  ```
- **Test a restore** with `scripts/restore.sh <TIMESTAMP>` against a scratch DB —
  an untested backup is not a backup.
- **Log rotation** is built in (`backend/logs/*.log` cap at 10 MB × 5 files).
- **Monitoring** — point your uptime monitor at `/api/health/ready` (verifies the
  DB, returns 503 if it's down), not just `/api/health`. Alert on downtime.
- Keep the OS, Node, MySQL, and nginx patched.

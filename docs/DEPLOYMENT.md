# Deployment Guide: Client Ops Hub

## 1) DNS records
- `A clients.graphiclux.com -> <VPS IPv4>`
- `AAAA clients.graphiclux.com -> <VPS IPv6>` (optional)
- `A vault.graphiclux.com -> <VPS IPv4>` (optional but recommended)

## 2) Server bootstrap (Ubuntu)
1. Install Docker + Docker Compose plugin.
2. Clone repo to `/opt/client-ops-hub`.
3. Copy `.env.example` to `.env` and fill all secrets.
4. Generate `MASTER_KEY` (32-byte base64):
   ```bash
   openssl rand -base64 32
   ```

## 3) Xero app setup
1. In Xero Developer portal, create an OAuth 2.0 app.
2. Add redirect URI:
   - `https://clients.graphiclux.com/api/integrations/xero/callback`
3. Set `XERO_CLIENT_ID`, `XERO_CLIENT_SECRET`, `XERO_REDIRECT_URI`.

## 4) Trello setup
Preferred OAuth:
- Set `TRELLO_API_KEY`
- Set `TRELLO_REDIRECT_URI=https://clients.graphiclux.com/settings/integrations/trello-callback`

Fallback token flow:
- If Trello app settings require it, keep `TRELLO_CLIENT_ID`/`TRELLO_CLIENT_SECRET` for future OAuth code flow migration.

## 5) Start stack
```bash
docker compose build
docker compose up -d
```

The stack includes:
- `app` (Next.js web)
- `worker` (BullMQ background jobs for integrations/audit processing)
- `postgres`
- `redis`
- `traefik`
- `vaultwarden`

## 6) Run migrations + seed admin
```bash
docker compose exec app npm run prisma:migrate
docker compose exec app npm run prisma:seed
```

Ensure `.env` includes:
- `INITIAL_ADMIN_EMAIL=you@graphiclux.com`
- `INITIAL_ADMIN_PASSWORD=<strong password, 12+ chars>`
- Optional: `MANAGER_RESTRICT_TO_ASSIGNED_CLIENTS=true` to scope managers to owned/assigned clients only.

## 7) Validate critical routes
- `https://clients.graphiclux.com/login`
- `https://clients.graphiclux.com/setup-2fa` (after first password sign-in)
- `https://clients.graphiclux.com/settings/integrations`
- `https://clients.graphiclux.com/admin/users`

## 8) Nightly backup setup
1. Install `age` and either `rclone` or configure rsync target.
2. Set env vars in backup shell context:
   - `AGE_RECIPIENT`
   - `POSTGRES_USER`
   - `POSTGRES_DB`
   - Optional `STORAGEBOX_RSYNC_TARGET` or `RCLONE_REMOTE`
3. Add cron:
   ```bash
   0 2 * * * cd /opt/client-ops-hub && /bin/bash backups/nightly-backup.sh >> /var/log/clientops-backup.log 2>&1
   ```

## 9) VPS hardening baseline
- UFW:
  ```bash
  sudo ufw allow 22/tcp
  sudo ufw allow 80/tcp
  sudo ufw allow 443/tcp
  sudo ufw enable
  ```
- Install and configure fail2ban.
- Enable unattended upgrades:
  ```bash
  sudo apt install unattended-upgrades -y
  sudo dpkg-reconfigure unattended-upgrades
  ```

## 10) Post-deploy checklist
- Confirm only admin-created users can sign in.
- Confirm first login forces `/setup-2fa`.
- Confirm per-session 2FA challenge at `/verify-2fa` and optional "Remember this browser" behavior (`TWO_FACTOR_REMEMBER_DAYS`).
- Confirm RBAC by testing ADMIN/MANAGER/CONTRACTOR/READONLY.
- Confirm Trello card creation and Xero invoice summary call.
- Confirm Vault references are used instead of plaintext secrets.

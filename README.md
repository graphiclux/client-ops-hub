# Client Ops Hub

Production-focused client relationship + systems inventory app for agencies working across WordPress/Woo/Shopify, with Trello and Xero integrations.

## Stack
- Next.js 14 App Router + TypeScript
- TailwindCSS + shadcn-style UI + lucide-react
- Prisma + PostgreSQL 16
- NextAuth (email/password credentials) + forced TOTP enrollment
- Redis + BullMQ
- Dedicated BullMQ worker process (`worker` service in Docker Compose)
- Docker Compose + Traefik + Let's Encrypt
- Vaultwarden in same stack

## Required Routes
- `/clients`
- `/clients/[id]`
- `/engagements`
- `/search`
- `/settings/integrations`
- `/admin/users`
- `/admin/audit-logs`
- `/setup-2fa`
- `/login`

## Security Highlights
- Admin-created users with email/password authentication
- Mandatory TOTP setup gate after first login
- RBAC (ADMIN, MANAGER, CONTRACTOR, READONLY)
- Optional manager scoping via `MANAGER_RESTRICT_TO_ASSIGNED_CLIENTS=true`
- Contractor client scoping via `ClientUser`
- AES-256-GCM encryption at rest for TOTP secret and integration tokens
- Audit logs for auth, CRUD, integrations, and attachment downloads
- Security headers + CSRF checks + auth/integration rate limiting
- Vault references only (`vault_item_ref`), no password storage

## Quick Start (local)
1. Copy `.env.example` to `.env` and fill values.
2. Install deps: `npm install`
3. Generate Prisma client: `npm run prisma:generate`
4. Run migrations: `npm run prisma:migrate`
5. Seed initial admin: `npm run prisma:seed`
6. Start app: `npm run dev`

## Docker Deploy
Use `docs/DEPLOYMENT.md` for full Hetzner setup.

### Faster production deploys
- GitHub Actions workflow `.github/workflows/docker-publish.yml` pushes app images to GHCR on every `main` push.
- Use `docker-compose.prod.yml` on server to pull prebuilt images instead of rebuilding locally.

## Notes
- Attachment storage is local volume (`/data/uploads`) with adapter structure prepared for S3-compatible storage in phase 2.
- Trello supports OAuth callback path and secure per-user token storage fallback.
- Xero OAuth uses `offline_access`; tenant selection is supported via `/api/integrations/xero/tenant`.

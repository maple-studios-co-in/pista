# Deploying Pista on your own hosting

Pista is a standard Next.js 14 app with a Prisma database. You can run it three
ways. **Docker is recommended** for a server/VPS.

## CI/CD overview

Two GitHub Actions workflows are included:

| Workflow | Trigger | What it does |
| --- | --- | --- |
| `.github/workflows/ci.yml` | push / PR to `main` | Installs deps and runs `next build` — fails the PR if the app doesn't compile. |
| `.github/workflows/docker-publish.yml` | push to `main`, tags `v*` | Builds the Docker image and pushes it to **GHCR** at `ghcr.io/maple-studios-co-in/pista`. Uses the built-in `GITHUB_TOKEN` — no secrets to set up. |

So every merge to `main` automatically produces a ready-to-run image. Your
hosting just pulls and runs it.

> Make the GHCR package public (or grant your server a read token):
> GitHub → repo → **Packages** → `pista` → Package settings → visibility.

---

## Option A — Run the prebuilt image from GHCR (simplest)

On your server (Docker installed):

```bash
docker run -d --name pista -p 3000:3000 \
  -e DATABASE_URL="file:./dev.db" \
  -e NEXTAUTH_URL="https://order.yourdomain.com" \
  -e NEXTAUTH_SECRET="$(openssl rand -base64 32)" \
  -v pista-db:/app/prisma \
  ghcr.io/maple-studios-co-in/pista:latest

# first run only — seed the menu + demo data
docker exec pista npm run seed
```

The container runs `prisma db push` on start, so the schema is created
automatically. The `pista-db` volume persists the SQLite database.

## Option B — Docker Compose (build locally)

```bash
echo "NEXTAUTH_SECRET=$(openssl rand -base64 32)" > .env
echo "NEXTAUTH_URL=https://order.yourdomain.com" >> .env

docker compose up -d --build
docker compose exec app npm run seed   # first run only
```

## Option C — Plain Node + PM2 (no Docker)

Requires Node 20+ on the server.

```bash
git clone https://github.com/maple-studios-co-in/pista.git
cd pista
cp .env.example .env          # set a real NEXTAUTH_SECRET + NEXTAUTH_URL
npm ci
npm run setup                 # prisma db push + seed
npm run build
npx pm2 start "npm start" --name pista   # or: npm start
```

---

## Environment variables

| Variable | Required | Notes |
| --- | --- | --- |
| `DATABASE_URL` | yes | `file:./dev.db` for SQLite, or a Postgres URL |
| `NEXTAUTH_URL` | yes | Public URL of the app, e.g. `https://order.yourdomain.com` |
| `NEXTAUTH_SECRET` | yes | Long random string — `openssl rand -base64 32` |

## Database: SQLite vs Postgres

- **SQLite (default)** — zero setup, fine for a single instance. Persist
  `/app/prisma` (Docker volume) so data survives restarts.
- **Postgres (recommended at scale / multi-instance)**:
  1. In `prisma/schema.prisma`, set `provider = "postgresql"`.
  2. Set `DATABASE_URL` to your Postgres connection string.
  3. Run `npx prisma db push` (or generate a migration), then `npm run seed`.

## Put it behind HTTPS

Run the app on `127.0.0.1:3000` and terminate TLS with a reverse proxy.

**Caddy** (automatic HTTPS):

```
order.yourdomain.com {
    reverse_proxy 127.0.0.1:3000
}
```

**Nginx** (with certbot for certs):

```nginx
server {
    server_name order.yourdomain.com;
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

## Going-live checklist

- [ ] Strong `NEXTAUTH_SECRET` set (not the dev placeholder)
- [ ] `NEXTAUTH_URL` matches the public HTTPS URL
- [ ] Database persisted (volume) or pointed at managed Postgres
- [ ] Seeded once; change the demo admin password or create a real admin
- [ ] HTTPS via reverse proxy
- [ ] GHCR image visibility/token configured for your server to pull

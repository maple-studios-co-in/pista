# Bringing café subdomains online

Goal: a café you provision in `/super` becomes reachable at
`https://<slug>.pista.maplestudios.co.in` with working logins.

There are three things to set up — **once for the platform**, then **one command
per café**.

## 1. Wildcard DNS (once)

Add a wildcard A record so every café subdomain resolves to the VPS:

```
*.pista   A   <your-vps-ip>     (in maplestudios.co.in DNS)
```

Verify: `dig +short anything.pista.maplestudios.co.in` returns your IP.

## 2. Cross-subdomain login cookies (once)

So a login works on any café subdomain, set `COOKIE_DOMAIN` on the server and
restart:

```bash
echo 'COOKIE_DOMAIN=".pista.maplestudios.co.in"' >> /var/www/pista/.env
pm2 restart pista --update-env
```

This makes the auth cookies valid across `pista…` and all `*.pista…`. It's
**opt-in** — without it, the app keeps using host-only cookies (current apex
behaviour). Setting it changes the cookie names once, so everyone re-logs in.

> Each café still owns its customers: a session carries the user's `tenantId`,
> and storefront/admin actions are validated against the café being viewed.

## 3. Per-café: create the site + cert (one command each)

After creating the café in `/super`, run on the VPS:

```bash
cd /var/www/pista
./scripts/add-cafe.sh <slug>      # e.g. ./scripts/add-cafe.sh bluetokai
```

This writes the café's Nginx server block, reloads Nginx, and issues an HTTPS
cert via Let's Encrypt (HTTP-01). The café is then live at
`https://<slug>.pista.maplestudios.co.in`.

## Alternative: one wildcard certificate (optional, at scale)

Instead of a cert per café you can issue a single wildcard cert for
`*.pista.maplestudios.co.in`. This needs a **DNS-01** challenge (your DNS
provider's API), e.g. with `acme.sh`:

```bash
acme.sh --issue --dns dns_<provider> -d "*.pista.maplestudios.co.in"
```

Then a single Nginx block with a regex `server_name` handles every café:

```nginx
server {
    listen 443 ssl;
    server_name ~^(?<sub>[^.]+)\.pista\.maplestudios\.co\.in$;
    ssl_certificate     /path/fullchain.pem;
    ssl_certificate_key /path/privkey.pem;
    location / { proxy_pass http://127.0.0.1:3000; /* + forwarded headers */ }
}
```

Start with per-café certs (§3, no DNS API needed); move to wildcard when you have
many cafés.

## Recap

| Scope | Action |
| --- | --- |
| Once | Wildcard DNS `*.pista` → IP |
| Once | `COOKIE_DOMAIN=".pista.maplestudios.co.in"` + restart |
| Per café | `./scripts/add-cafe.sh <slug>` |

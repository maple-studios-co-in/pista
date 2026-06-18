# Zero-touch café subdomains (wildcard TLS)

Goal: after this one-time setup, a café you create in `/super` is **instantly live**
at `https://<slug>.pista.maplestudios.co.in` — no `add-cafe.sh`, no per-café step.

It works by issuing **one wildcard certificate** for `*.pista.maplestudios.co.in`
(via a DNS-01 challenge) and serving every café subdomain from **one Nginx block**.

---

## 0. Prerequisites

- The `*.pista` DNS record must be **DNS-only (grey cloud)** in Cloudflare, pointing
  at your VPS IP. (Cloudflare's free edge cert doesn't cover third-level wildcards,
  so café subdomains must hit your origin directly. DNS-01 issuance itself works
  regardless of proxy status.)
- The Pista app running on `127.0.0.1:3000` (PM2), with the latest code deployed
  (so subdomains route to the right café).

## 1. Cloudflare API token

Cloudflare dashboard → **My Profile → API Tokens → Create Token → Edit zone DNS**:
- Permissions: `Zone → DNS → Edit`
- Zone Resources: `Include → Specific zone → maplestudios.co.in`

Copy the token. Also grab your **Account ID** (Cloudflare dashboard → right sidebar).

## 2. Install acme.sh and issue the wildcard cert

On the VPS:

```bash
curl https://get.acme.sh | sh -s email=admin@maplestudios.co.in
export CF_Token="<your-cloudflare-api-token>"
export CF_Account_ID="<your-cloudflare-account-id>"

~/.acme.sh/acme.sh --set-default-ca --server letsencrypt
~/.acme.sh/acme.sh --issue --dns dns_cf \
  -d 'pista.maplestudios.co.in' -d '*.pista.maplestudios.co.in'
```

acme.sh adds a temporary DNS TXT record, validates, and installs an **auto-renew
cron** for you.

## 3. Install the cert where Nginx can read it

```bash
sudo mkdir -p /etc/ssl/pista
sudo ~/.acme.sh/acme.sh --install-cert -d '*.pista.maplestudios.co.in' \
  --key-file       /etc/ssl/pista/wildcard.key \
  --fullchain-file /etc/ssl/pista/wildcard.crt \
  --reloadcmd      "systemctl reload nginx"
```

## 4. One Nginx block for all café subdomains

Copy the provided block (`scripts/nginx-pista-wildcard.conf`) into Nginx:

```bash
sudo cp /var/www/pista/scripts/nginx-pista-wildcard.conf \
        /etc/nginx/sites-available/pista-wildcard
sudo ln -sf /etc/nginx/sites-available/pista-wildcard /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

It uses a **regex `server_name`** that matches every `*.pista.maplestudios.co.in`
and proxies to the app. Nginx still prefers any exact-match block you already made
(e.g. an old `test.pista…` site), so existing cafés keep working — the wildcard
just catches all the rest.

## 5. Done — verify

```bash
curl -skI https://anynewcafe.pista.maplestudios.co.in/   # 200 once that slug exists in /super
```

From now on: **create a café in `/super` → it's live.** No server step.

> You can retire `scripts/add-cafe.sh` after this (it's only needed for the
> per-subdomain-cert approach). Keep it as a fallback if you ever move a café to a
> custom domain.

## Renewal

acme.sh installs a cron that renews ~60 days out and runs the `--reloadcmd`
(reloads Nginx). Nothing to do. Check with: `~/.acme.sh/acme.sh --list`.

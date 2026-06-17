#!/usr/bin/env bash
#
# Bring a provisioned café's subdomain online: create its Nginx site + issue an
# HTTPS cert. Run after you've created the café in /super.
#
#   ./scripts/add-cafe.sh <slug>
#   e.g. ./scripts/add-cafe.sh bluetokai   ->   https://bluetokai.pista.maplestudios.co.in
#
# Requires a wildcard DNS record  *.<BASE_DOMAIN> -> this server's IP.
#
set -euo pipefail

SLUG="${1:?usage: add-cafe.sh <slug>}"
BASE="${BASE_DOMAIN:-pista.maplestudios.co.in}"
EMAIL="${LE_EMAIL:-admin@maplestudios.co.in}"
PORT="${PORT:-3000}"
DOMAIN="${SLUG}.${BASE}"
F="/etc/nginx/sites-available/${DOMAIN}"

echo "▶ Bringing up ${DOMAIN}"

if [ ! -f "$F" ]; then
  sudo tee "$F" >/dev/null <<EOF
server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAIN};

    location / {
        proxy_pass http://127.0.0.1:${PORT};
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOF
  sudo ln -sf "$F" "/etc/nginx/sites-enabled/${DOMAIN}"
fi

sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d "${DOMAIN}" --non-interactive --agree-tos -m "${EMAIL}" --redirect \
  || { echo "⚠ certbot failed — check DNS ( dig +short ${DOMAIN} ) then retry"; exit 1; }

echo "✓ ${DOMAIN} is live"

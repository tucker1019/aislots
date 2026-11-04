#!/bin/sh
set -eu
cd "$(dirname "$0")"
docker run --rm \
  -v "$PWD/certificates:/etc/letsencrypt" \
  -v "$PWD/acme:/var/www/acme" \
  certbot/certbot renew --quiet
docker compose exec -T web nginx -t
docker compose exec -T web nginx -s reload

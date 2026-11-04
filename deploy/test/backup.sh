#!/bin/sh
set -eu
cd "$(dirname "$0")"
umask 077
stamp=$(date -u +%Y%m%dT%H%M%SZ)
mkdir -p backups
for target in lobby game; do
    if [ "$target" = lobby ]; then user=lobby; database=aislots_lobby; else user=aislots; database=aislots; fi
    docker compose exec -T "$target-db" pg_dump -U "$user" -d "$database" -Fc > "backups/$target-$stamp.dump.tmp"
    mv "backups/$target-$stamp.dump.tmp" "backups/$target-$stamp.dump"
done
# Backups are retained until explicitly removed. Copy off-host for disaster recovery.

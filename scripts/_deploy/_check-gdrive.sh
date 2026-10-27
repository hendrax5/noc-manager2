#!/usr/bin/env bash
# Read-only status of the Google Drive attachment archive.
# Run as root on the NOC host:  sudo scripts/_deploy/_check-gdrive.sh
set -u

APP_DIR=/home/nochspnet/noc-manager2
cd "$APP_DIR" || { echo "app dir not found: $APP_DIR"; exit 1; }
[ "$(id -u)" -eq 0 ] || { echo "run as root (sudo)"; exit 1; }

echo "== container =="
docker ps --filter name=noc-manager2-app-1 --format '{{.Names}}|{{.Image}}|{{.Status}}'
docker exec noc-manager2-app-1 node -e "console.log('version='+require('/app/package.json').version)" 2>/dev/null || true

echo "== env presence (values hidden) =="
docker exec noc-manager2-app-1 sh -c 'for k in GDRIVE_MODE GDRIVE_FOLDER_ID GDRIVE_SHARED_DRIVE_ID GDRIVE_SERVICE_ACCOUNT_B64 GDRIVE_IMPERSONATE GDRIVE_CLIENT_ID GDRIVE_REFRESH_TOKEN; do v=$(printenv "$k" 2>/dev/null || true); if [ -n "$v" ]; then echo "$k=set(${#v} chars)"; else echo "$k=empty"; fi; done'

echo "== archive counters =="
docker exec noc-manager2-app-1 node -e "fetch('http://127.0.0.1:3000/api/internal/drive-sync/run',{headers:{'x-cron-secret':process.env.SCHEDULE_CRON_SECRET}}).then(async r=>console.log(r.status,await r.text()))" || true

echo "== preflight (token + folder access) =="
docker exec noc-manager2-app-1 node -e "fetch('http://127.0.0.1:3000/api/internal/drive-sync/check',{headers:{'x-cron-secret':process.env.SCHEDULE_CRON_SECRET}}).then(async r=>console.log(r.status,await r.text()))" || echo 'check endpoint unavailable (image < 3.13.1)'

echo "== attachment rows =="
docker exec noc-manager2-db-1 psql -U postgres -d nocticketing -t -A -F'|' -c 'SELECT "driveStatus", count(*) FROM "Attachment" GROUP BY 1 ORDER BY 1;'

echo "== failed rows (latest 5) =="
docker exec noc-manager2-db-1 psql -U postgres -d nocticketing -t -A -F'|' -c 'SELECT id, filename, "driveAttempts", left(coalesce("driveError", $$-$$), 120) FROM "Attachment" WHERE "driveStatus" = $$failed$$ ORDER BY id DESC LIMIT 5;'

echo "== recent drive-sync logs =="
docker logs --since 30m noc-manager2-app-1 2>&1 | grep -i 'drive-sync' | tail -5 || echo none

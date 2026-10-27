#!/usr/bin/env bash
# Activate the Google Drive attachment archive in one shot (root on the NOC host).
#
#   sudo scripts/_deploy/_activate-gdrive.sh --sa-file /root/gdrive-sa.json --folder-id FOLDER_ID \
#        [--shared-drive-id ID] [--impersonate user@domain] [--test-attachment 2644]
#
#   sudo scripts/_deploy/_activate-gdrive.sh --mode oauth --folder-id FOLDER_ID \
#        --oauth-client-id ID --oauth-client-secret SECRET --oauth-refresh-token TOKEN
#
# Writes GDRIVE_* to /home/nochspnet/noc-manager2/.env (backup kept), recreates the app
# container, runs the read-only preflight, and restores .env automatically if preflight fails.
set -euo pipefail

APP_DIR=/home/nochspnet/noc-manager2
ENV_FILE="$APP_DIR/.env"
MODE=service_account
FOLDER_ID=""
SHARED_DRIVE_ID=""
IMPERSONATE=""
SA_FILE=""
SA_B64=""
OAUTH_CLIENT_ID=""
OAUTH_CLIENT_SECRET=""
OAUTH_REFRESH_TOKEN=""
RELEASE_YML=""
TEST_ATTACHMENT=""
DRY_RUN=0

usage() {
  sed -n '2,15p' "$0" | sed 's/^# \{0,1\}//'
}

while [ $# -gt 0 ]; do
  case "$1" in
    --mode) MODE="${2:?}"; shift 2 ;;
    --folder-id) FOLDER_ID="${2:?}"; shift 2 ;;
    --shared-drive-id) SHARED_DRIVE_ID="${2:?}"; shift 2 ;;
    --impersonate) IMPERSONATE="${2:?}"; shift 2 ;;
    --sa-file) SA_FILE="${2:?}"; shift 2 ;;
    --sa-b64) SA_B64="${2:?}"; shift 2 ;;
    --oauth-client-id) OAUTH_CLIENT_ID="${2:?}"; shift 2 ;;
    --oauth-client-secret) OAUTH_CLIENT_SECRET="${2:?}"; shift 2 ;;
    --oauth-refresh-token) OAUTH_REFRESH_TOKEN="${2:?}"; shift 2 ;;
    --release-yml) RELEASE_YML="${2:?}"; shift 2 ;;
    --test-attachment) TEST_ATTACHMENT="${2:?}"; shift 2 ;;
    --dry-run) DRY_RUN=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "unknown argument: $1"; usage; exit 2 ;;
  esac
done

[ "$(id -u)" -eq 0 ] || { echo "run as root (sudo)"; exit 1; }
[ -d "$APP_DIR" ] || { echo "app dir not found: $APP_DIR"; exit 1; }
[ -n "$FOLDER_ID" ] || { echo "--folder-id is required"; exit 2; }

VALIDATE_SA='
import json,sys
data = json.load(open(sys.argv[1]))
assert data.get("client_email"), "client_email missing"
assert "PRIVATE KEY" in data.get("private_key", ""), "private_key missing"
print(data["client_email"])
'

case "$MODE" in
  service_account)
    if [ -n "$SA_FILE" ]; then
      [ -f "$SA_FILE" ] || { echo "SA file not found: $SA_FILE"; exit 2; }
      SA_ID=$(python3 -c "$VALIDATE_SA" "$SA_FILE")
      SA_B64=$(base64 -w0 "$SA_FILE")
    elif [ -n "$SA_B64" ]; then
      SA_ID=$(printf '%s' "$SA_B64" | base64 -d | python3 -c 'import json,sys; d=json.load(sys.stdin); assert d.get("client_email"), "client_email missing"; print(d["client_email"])')
    else
      echo "mode service_account needs --sa-file or --sa-b64"; exit 2
    fi
    ;;
  oauth)
    [ -n "$OAUTH_CLIENT_ID" ] && [ -n "$OAUTH_CLIENT_SECRET" ] && [ -n "$OAUTH_REFRESH_TOKEN" ] \
      || { echo "mode oauth needs --oauth-client-id, --oauth-client-secret, --oauth-refresh-token"; exit 2; }
    ;;
  *)
    echo "--mode must be service_account or oauth"; exit 2 ;;
esac

cd "$APP_DIR"
if [ -z "$RELEASE_YML" ]; then
  CURRENT_IMAGE=$(docker inspect -f '{{.Config.Image}}' noc-manager2-app-1)
  RELEASE_YML=$(grep -l "image: $CURRENT_IMAGE" /opt/noc-manager2/releases/*/release.yml 2>/dev/null | tail -1 || true)
fi
[ -n "$RELEASE_YML" ] && [ -f "$RELEASE_YML" ] || { echo "release.yml not found; pass --release-yml"; exit 2; }

TMP=$(mktemp)
{
  echo "GDRIVE_MODE=$MODE"
  echo "GDRIVE_FOLDER_ID=$FOLDER_ID"
  [ -n "$SHARED_DRIVE_ID" ] && echo "GDRIVE_SHARED_DRIVE_ID=$SHARED_DRIVE_ID"
  if [ "$MODE" = service_account ]; then
    echo "GDRIVE_SERVICE_ACCOUNT_B64=$SA_B64"
    [ -n "$IMPERSONATE" ] && echo "GDRIVE_IMPERSONATE=$IMPERSONATE"
  else
    echo "GDRIVE_CLIENT_ID=$OAUTH_CLIENT_ID"
    echo "GDRIVE_CLIENT_SECRET=$OAUTH_CLIENT_SECRET"
    echo "GDRIVE_REFRESH_TOKEN=$OAUTH_REFRESH_TOKEN"
  fi
} > "$TMP"

echo "== plan =="
echo "mode=$MODE folder_id=$FOLDER_ID release_yml=$RELEASE_YML"
[ -n "${SA_ID:-}" ] && echo "service_account=$SA_ID"
sed 's/=.*/=<set>/' "$TMP"

if [ "$DRY_RUN" -eq 1 ]; then
  echo "DRY_RUN ok (.env not modified)"
  rm -f "$TMP"
  exit 0
fi

TS=$(date -u +%Y%m%dT%H%M%SZ)
cp -a "$ENV_FILE" "$ENV_FILE.bak.$TS"
chmod 600 "$ENV_FILE.bak.$TS"
grep -vE '^(GDRIVE_MODE|GDRIVE_FOLDER_ID|GDRIVE_SHARED_DRIVE_ID|GDRIVE_SERVICE_ACCOUNT_B64|GDRIVE_SERVICE_ACCOUNT_JSON|GDRIVE_IMPERSONATE|GDRIVE_CLIENT_ID|GDRIVE_CLIENT_SECRET|GDRIVE_REFRESH_TOKEN)=' "$ENV_FILE" > "$ENV_FILE.tmp" || true
cat "$TMP" >> "$ENV_FILE.tmp"
mv "$ENV_FILE.tmp" "$ENV_FILE"
chmod 600 "$ENV_FILE"
rm -f "$TMP"
echo "env updated (backup: $ENV_FILE.bak.$TS)"

restore_and_exit() {
  echo "!! activation failed; restoring .env and container"
  cp -a "$ENV_FILE.bak.$TS" "$ENV_FILE"
  chmod 600 "$ENV_FILE"
  docker compose -p noc-manager2 -f docker-compose.prod.yml -f "$RELEASE_YML" up -d --no-deps --no-build app >/dev/null 2>&1 || true
  exit 1
}

if ! docker compose -p noc-manager2 -f docker-compose.prod.yml -f "$RELEASE_YML" up -d --no-deps --no-build app; then
  restore_and_exit
fi

echo "container recreated; waiting for app..."
READY=0
for _ in $(seq 1 60); do
  if docker exec noc-manager2-app-1 node -e "fetch('http://127.0.0.1:3000/login').then(r=>process.exit(r.status<500?0:1)).catch(()=>process.exit(1))" >/dev/null 2>&1; then
    READY=1
    break
  fi
  sleep 2
done
[ "$READY" -eq 1 ] || restore_and_exit

CHECK=$(docker exec noc-manager2-app-1 node -e "fetch('http://127.0.0.1:3000/api/internal/drive-sync/check',{headers:{'x-cron-secret':process.env.SCHEDULE_CRON_SECRET}}).then(async r=>process.stdout.write(await r.text())).catch(e=>process.stdout.write(JSON.stringify({ok:false,error:e.message})))")
echo "preflight=$CHECK"
case "$CHECK" in
  *'"ok":true'*) ;;
  *) echo "preflight failed (token/folder access)"; restore_and_exit ;;
esac

if [ -n "$TEST_ATTACHMENT" ]; then
  echo "== sync test attachment $TEST_ATTACHMENT =="
  docker exec noc-manager2-app-1 node -e "fetch('http://127.0.0.1:3000/api/internal/drive-sync/backfill',{method:'POST',headers:{'x-cron-secret':process.env.SCHEDULE_CRON_SECRET,'Content-Type':'application/json'},body:JSON.stringify({id:$TEST_ATTACHMENT})}).then(async r=>console.log(r.status,await r.text()))"
fi

echo "== status =="
docker exec noc-manager2-app-1 node -e "fetch('http://127.0.0.1:3000/api/internal/drive-sync/run',{headers:{'x-cron-secret':process.env.SCHEDULE_CRON_SECRET}}).then(async r=>console.log(r.status,await r.text()))"
echo "AKTIVASI_OK"

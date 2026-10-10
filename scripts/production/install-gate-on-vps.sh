#!/usr/bin/env bash
# Installs the production deploy gate ON THE VPS. Run as root, ONLY after the owner has approved the production-control change
# (docs/production-deployment-control.md, step 3). It changes no application code and does not restart the live app.
set -euo pipefail
SRC="$(cd "$(dirname "$0")" && pwd)"
install -d -m 755 /usr/local/lib/dgt
install -m 755 "$SRC/dgt-deploy-gate.sh" /usr/local/lib/dgt/dgt-deploy-gate.sh
install -m 755 "$SRC/dgt-approve-deploy.sh" /usr/local/lib/dgt/dgt-approve-deploy.sh
install -d -m 700 /etc/dgt-deploy
[ -f /etc/dgt-deploy/env ] || cat > /etc/dgt-deploy/env <<'ENVEOF'
APP_DIR=/var/www/dgt-nextjs
RELEASE_BRANCH=production
BACKUP_DIR=/root/backups
BACKUP_CMD='set -a; . /var/www/dgt-nextjs/.env; set +a; pg_dump "$DATABASE_URL" --schema=public --no-owner --no-privileges -Fc -f "$BACKUP_FILE" && pg_restore --list "$BACKUP_FILE" >/dev/null'
ENVEOF
chmod 600 /etc/dgt-deploy/env
cat > /usr/local/sbin/dgt-deploy <<'WRAP'
#!/usr/bin/env bash
set -a; . /etc/dgt-deploy/env; set +a
exec /usr/local/lib/dgt/dgt-deploy-gate.sh "$@"
WRAP
cat > /usr/local/sbin/dgt-approve-deploy <<'WRAP'
#!/usr/bin/env bash
set -a; . /etc/dgt-deploy/env; set +a
exec /usr/local/lib/dgt/dgt-approve-deploy.sh "$@"
WRAP
chmod 755 /usr/local/sbin/dgt-deploy /usr/local/sbin/dgt-approve-deploy
touch /var/log/dgt-deploy.log; chmod 640 /var/log/dgt-deploy.log
echo "Installed. Check:  dgt-deploy --dry-run   (expected: REFUSED: no approval file)"

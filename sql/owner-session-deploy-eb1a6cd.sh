#!/usr/bin/env bash
# OWNER / AUTHORIZED SERVER-ADMIN SESSION ONLY.
# Production release of eb1a6cd: release SQL, Roznamcha test cleanup + serial reset, gate deploy, live checks.
# Run each step by hand and read its output before the next one. Stops on the first error.
set -euo pipefail

RELEASE_DIR="D:/dgt-tests/release"
SHA="eb1a6cd"
VPS="root@72.60.209.121"
cd "$RELEASE_DIR"

# 0. The release commit must be clean and must be eb1a6cd.
test "$(git rev-parse --short HEAD)" = "$SHA"
test -z "$(git status --porcelain --untracked-files=no)"
echo "OK: HEAD is $SHA and the tracked tree is clean"

# 1. Backups must exist and verify on the VPS (created 16 Nov: full = 8598 TOC entries, sha256 255b63e1...).
ssh -o BatchMode=yes "$VPS" 'ls -la /root/backups/prod-full-before-cleanup-20261116-193322.dump && sha256sum /root/backups/prod-full-before-cleanup-20261116-193322.dump && pg_restore --list /root/backups/prod-full-before-cleanup-20261116-193322.dump | wc -l'

# 2. Upload the two SQL files.
scp sql/production-release-20261116.sql sql/production-cleanup-roznamcha-test-20261116.sql "$VPS":/root/

# 3. Release SQL (categories, RLS, carried_forward_from column, translations). Must succeed BEFORE the gate deploy.
ssh -o BatchMode=yes "$VPS" 'set -a; . /var/www/dgt-nextjs/.env; set +a; psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f /root/production-release-20261116.sql'

# 4. Roznamcha cleanup (five test entries, reversal links kept, serial counters to 001). Preconditions abort if anything differs.
ssh -o BatchMode=yes "$VPS" 'set -a; . /var/www/dgt-nextjs/.env; set +a; psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f /root/production-cleanup-roznamcha-test-20261116.sql'

# 5. Verify counters and live entries (expect: 0 live entries, all seven counters at next_value 1).
ssh -o BatchMode=yes "$VPS" 'set -a; . /var/www/dgt-nextjs/.env; set +a; psql "$DATABASE_URL" -At -c "select count(*) from public.roznamcha_entries where deleted_at is null" -c "select count(*) from public.transaction_serial_sequences where entity_type in (\x27roznamcha\x27,\x27roznamcha_debit\x27,\x27roznamcha_credit\x27) and next_value = 1"'

# 6. Gate: dry run first, then the real deploy (migrations approved for this commit).
scripts/production/deploy-via-gate.sh "$SHA" --migrations --dry-run
scripts/production/deploy-via-gate.sh "$SHA" --migrations

# 7. Live checks on the VPS: live HEAD, PM2 status, HTTP.
ssh -o BatchMode=yes "$VPS" 'cd /var/www/dgt-nextjs && echo "live HEAD: $(git rev-parse --short HEAD)" && pm2 list | head -8 && curl -s -o /dev/null -w "http=%{http_code}\n" http://127.0.0.1:3000/'

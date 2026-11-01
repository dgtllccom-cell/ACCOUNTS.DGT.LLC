#!/usr/bin/env bash
# The ONE supported way to deploy: promote a commit to the protected `production` branch and run the controlled gate on the VPS
# (owner approval file -> dry-run -> database backup -> isolated build -> atomic swap -> pm2 reload; one deployment per approval).
#   scripts/production/deploy-via-gate.sh [<commit>] [--migrations] [--dry-run]
# Never resets / pulls / builds the live checkout by hand: the live build is refused unless HEAD is the approved commit.
set -euo pipefail
VPS="${VPS:-root@72.60.209.121}"
SHA="$(git rev-parse "${1:-HEAD}")"; shift || true
MIG=""; DRY=0
for a in "$@"; do case "$a" in --migrations) MIG="--migrations";; --dry-run) DRY=1;; esac; done
[ "$(git status --porcelain --untracked-files=no | wc -l)" = 0 ] || { echo "uncommitted changes - commit first (the gate deploys a commit, not a working tree)"; exit 1; }
echo "== deploying $SHA (migrations: ${MIG:-no})"
git push origin "$SHA:refs/heads/production"
ssh -o BatchMode=yes "$VPS" "if ps aux | grep -E 'next build|safe-build-deploy|npm run build' | grep -v grep >/dev/null; then echo 'a build is already running on the server - wait for it to finish'; exit 3; fi; dgt-approve-deploy $SHA $MIG && dgt-deploy --dry-run"
[ "$DRY" = 1 ] && { echo "dry-run only - nothing changed"; exit 0; }
ssh -o BatchMode=yes "$VPS" "setsid nohup dgt-deploy > /tmp/dgt-deploy-run.out 2>&1 < /dev/null &"
echo "== deploy started - waiting for the gate"
ssh -o BatchMode=yes "$VPS" "until tail -1 /var/log/dgt-deploy.log | grep -qE 'DEPLOYED $SHA|FAILED|REFUSED'; do sleep 10; done; tail -4 /var/log/dgt-deploy.log"
ssh -o BatchMode=yes "$VPS" "cd /var/www/dgt-nextjs && echo live HEAD: \$(git rev-parse HEAD) && pm2 jlist | node -e 'let s=\"\";process.stdin.on(\"data\",d=>s+=d).on(\"end\",()=>{const p=JSON.parse(s).find(x=>x.name===\"dgt-nextjs\");console.log(\"pm2:\",p.pm2_env.status)})'"

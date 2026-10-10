#!/usr/bin/env bash
# Moves the live checkout from tracking `main` to tracking `production` — a NAME change only: the working tree, the running build and PM2 are not touched.
# It refuses unless the live checkout is already EXACTLY at origin/production (otherwise the switch would change the running code).
#   switch-vps-to-production-branch.sh --dry-run   shows what would happen
#   switch-vps-to-production-branch.sh             does it (needs the owner's approval)
#   switch-vps-to-production-branch.sh --revert    goes back to tracking main (same commit rule)
set -euo pipefail
APP_DIR="${APP_DIR:-/var/www/dgt-nextjs}"; cd "$APP_DIR"
mode="${1:-apply}"
git fetch -q origin main production
head="$(git rev-parse HEAD)"; prod="$(git rev-parse origin/production)"; main="$(git rev-parse origin/main)"
echo "live HEAD:        $head"; echo "origin/production: $prod"; echo "origin/main:       $main"
target="production"; [ "$mode" = "--revert" ] && target="main"
want="$(git rev-parse "origin/$target")"
[ "$head" = "$want" ] || { echo "REFUSED: the live checkout is not at origin/$target, so switching would change the running code. Deploy through dgt-deploy first."; exit 1; }
echo "current branch: $(git rev-parse --abbrev-ref HEAD)  ->  $target (same commit; nothing is rebuilt or restarted)"
[ "$mode" = "--dry-run" ] && { echo "dry-run: nothing changed"; exit 0; }
git checkout -q -B "$target" "origin/$target"
git branch -q --set-upstream-to="origin/$target" "$target"
echo "now on $(git rev-parse --abbrev-ref HEAD) tracking origin/$target at $(git rev-parse --short HEAD)"
echo "revert any time with: $0 --revert"

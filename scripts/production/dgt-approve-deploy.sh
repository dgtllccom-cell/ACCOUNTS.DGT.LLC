#!/usr/bin/env bash
# Owner approval for ONE production deployment.   dgt-approve-deploy <commit> [--hours N] [--migrations]
# Writes /etc/dgt-deploy/approved (mode 600). dgt-deploy then deploys exactly that commit once. Only the owner should hold SSH access that can run this.
set -euo pipefail
APP_DIR="${APP_DIR:-/var/www/dgt-nextjs}"; APPROVAL_FILE="${APPROVAL_FILE:-/etc/dgt-deploy/approved}"; RELEASE_BRANCH="${RELEASE_BRANCH:-production}"
ref="${1:?usage: dgt-approve-deploy <commit> [--hours N] [--migrations]}"; shift || true
hours=4; migs=no
while [ $# -gt 0 ]; do case "$1" in --hours) hours="$2"; shift 2;; --migrations) migs=yes; shift;; *) echo "unknown option $1"; exit 2;; esac; done
cd "$APP_DIR"; git fetch -q origin "$RELEASE_BRANCH"
sha="$(git rev-parse --verify "$ref^{commit}")"
git merge-base --is-ancestor "$sha" "origin/$RELEASE_BRANCH" || { echo "REFUSED: $sha is not on origin/$RELEASE_BRANCH"; exit 1; }
mkdir -p "$(dirname "$APPROVAL_FILE")"; umask 077
printf 'sha=%s\nexpires=%s\nmigrations=%s\napproved_by=%s\nused=no\n' "$sha" "$(( $(date +%s) + hours*3600 ))" "$migs" "${SUDO_USER:-${USER:-owner}}" > "$APPROVAL_FILE"
echo "Approved $sha for $hours h (migrations: $migs). Now run: dgt-deploy"

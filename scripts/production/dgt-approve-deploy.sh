#!/usr/bin/env bash
# Owner approval for ONE production deployment.   dgt-approve-deploy <commit> [--hours N] [--migrations] [--replace]
# Writes /etc/dgt-deploy/approved (mode 600). dgt-deploy then deploys exactly that commit once. Only the owner should hold SSH access that can run this.
# Refuses while a deployment is running, and refuses to replace a pending (unused, unexpired) approval for another commit
# unless --replace is given — so a second person or script cannot silently swap the commit under a running deployment.
set -euo pipefail
APP_DIR="${APP_DIR:-/var/www/dgt-nextjs}"; APPROVAL_FILE="${APPROVAL_FILE:-/etc/dgt-deploy/approved}"; RELEASE_BRANCH="${RELEASE_BRANCH:-production}"
LOCK_DIR="${LOCK_DIR:-/tmp/dgt-deploy.lock}"; AUDIT_LOG="${AUDIT_LOG:-/var/log/dgt-deploy.log}"
ref="${1:?usage: dgt-approve-deploy <commit> [--hours N] [--migrations] [--replace]}"; shift || true
hours=4; migs=no; replace=no
while [ $# -gt 0 ]; do case "$1" in --hours) hours="$2"; shift 2;; --migrations) migs=yes; shift;; --replace) replace=yes; shift;; *) echo "unknown option $1"; exit 2;; esac; done
who="${SUDO_USER:-${USER:-owner}}"; from="${SSH_CLIENT:-}"; from="${from%% *}"
audit() { printf '%s %s\n' "$(date -u +%FT%TZ)" "$*" >> "$AUDIT_LOG" 2>/dev/null || true; }
[ -d "$LOCK_DIR" ] && { echo "REFUSED: a deployment is running right now (lock $LOCK_DIR) — wait for it to finish"; audit "approve REFUSED (deployment running): $ref by $who${from:+ from $from}"; exit 1; }
cd "$APP_DIR"; git fetch -q origin "$RELEASE_BRANCH"
sha="$(git rev-parse --verify "$ref^{commit}")"
git merge-base --is-ancestor "$sha" "origin/$RELEASE_BRANCH" || { echo "REFUSED: $sha is not on origin/$RELEASE_BRANCH"; exit 1; }
if [ -f "$APPROVAL_FILE" ] && [ "$replace" != yes ]; then
  p_sha=""; p_exp=0; p_used=""; p_by=""
  while IFS='=' read -r k v; do case "$k" in sha) p_sha="$v";; expires) p_exp="$v";; used) p_used="$v";; approved_by) p_by="$v";; esac; done < "$APPROVAL_FILE"
  if [ "$p_used" = "no" ] && [ "$(date +%s)" -le "${p_exp:-0}" ] && [[ "$p_sha" =~ ^[0-9a-f]{40}$ ]] && [ "$p_sha" != "$sha" ]; then
    echo "REFUSED: a pending approval for $p_sha (by ${p_by:-?}) exists. Deploy it with dgt-deploy, or replace it with: dgt-approve-deploy $ref --replace"
    audit "approve REFUSED (pending approval $p_sha): $sha by $who${from:+ from $from}"
    exit 1
  fi
fi
mkdir -p "$(dirname "$APPROVAL_FILE")"; umask 077
printf 'sha=%s\nexpires=%s\nmigrations=%s\napproved_by=%s\nused=no\n' "$sha" "$(( $(date +%s) + hours*3600 ))" "$migs" "$who" > "$APPROVAL_FILE"
audit "approved $sha for $hours h (migrations: $migs) by $who${from:+ from $from}"
echo "Approved $sha for $hours h (migrations: $migs). Now run: dgt-deploy"

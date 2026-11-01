#!/usr/bin/env bash
# Refuses (exit 1) unless the checked-out commit of the live checkout is EXACTLY the commit the owner approved for this deployment
# (approval file written by dgt-approve-deploy, consumed - used=yes - by dgt-deploy just before it builds, not expired).
# Called by scripts/safe-build-deploy.sh. On a server without the gate (no /etc/dgt-deploy: DEV, CI) it does nothing.
#   bash scripts/production/require-approved-commit.sh [repo_dir]
set -u
APPROVAL_FILE="${APPROVAL_FILE:-/etc/dgt-deploy/approved}"
[ -d "$(dirname "$APPROVAL_FILE")" ] || exit 0
repo="${1:-.}"
head="$(git -C "$repo" rev-parse HEAD 2>/dev/null)" || { echo "✗ REFUSED: not a git checkout" >&2; exit 1; }
refuse() {
  echo "" >&2
  echo "✗ REFUSED: the live build can only be made by the controlled gate for the commit the owner approved." >&2
  echo "  $1" >&2
  echo "  Deploy with: scripts/production/deploy-via-gate.sh <commit>   (see docs/production-deployment-control.md)" >&2
  exit 1
}
[ -f "$APPROVAL_FILE" ] || refuse "no approval file ($APPROVAL_FILE)."
sha=""; expires=0; used=""
while IFS='=' read -r k v; do case "$k" in sha) sha="$v";; expires) expires="$v";; used) used="$v";; esac; done < "$APPROVAL_FILE"
[ "$sha" = "$head" ] || refuse "checked-out commit $head is not the approved commit ${sha:-none}."
[ "$used" = "yes" ] || refuse "the approval has not been consumed by dgt-deploy."
[ "$(date +%s)" -le "${expires:-0}" ] || refuse "the approval expired."
exit 0

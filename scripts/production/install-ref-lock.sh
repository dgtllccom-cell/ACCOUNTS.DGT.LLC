#!/usr/bin/env bash
# Installs / removes the live-checkout ref lock.   install-ref-lock.sh install|remove|status   (run on the VPS as root; needs the owner's approval)
# The hook lives in a root-owned directory OUTSIDE the repository and core.hooksPath is pointed at it, because a checkout may set
# core.hooksPath=.githooks (the live one does) which makes git ignore .git/hooks, and tracked hook files can be rewritten by a reset.
set -euo pipefail
APP_DIR="${APP_DIR:-/var/www/dgt-nextjs}"; SRC="$(cd "$(dirname "$0")" && pwd)"
LOCK_DIR="${LOCK_DIR:-/usr/local/lib/dgt/githooks}"; SAVED="${SAVED:-/etc/dgt-deploy/prev-hookspath}"
case "${1:-install}" in
  install)
    mkdir -p "$LOCK_DIR" "$(dirname "$SAVED")"; chmod 755 "$LOCK_DIR" 2>/dev/null || true; chmod 700 "$(dirname "$SAVED")" 2>/dev/null || true
    cp "$SRC/ref-lock-hook.sh" "$LOCK_DIR/reference-transaction"; chmod 755 "$LOCK_DIR/reference-transaction"
    cur="$(git -C "$APP_DIR" config --local --get core.hooksPath || true)"
    if [ "$cur" != "$LOCK_DIR" ]; then printf '%s' "$cur" > "$SAVED"; fi
    git -C "$APP_DIR" config --local core.hooksPath "$LOCK_DIR"
    # keep the repo's own hooks working (none are needed on a server, but never break them silently)
    prev="$(cat "$SAVED" 2>/dev/null || true)"
    echo "ref lock installed (core.hooksPath ${prev:-<unset>} -> $LOCK_DIR)";;
  remove)
    prev="$(cat "$SAVED" 2>/dev/null || true)"
    if [ -n "$prev" ]; then git -C "$APP_DIR" config --local core.hooksPath "$prev"; else git -C "$APP_DIR" config --local --unset core.hooksPath || true; fi
    rm -f "$LOCK_DIR/reference-transaction" "$APP_DIR/.git/hooks/reference-transaction"
    echo "ref lock removed (core.hooksPath restored to '${prev:-<unset>}')";;
  status)
    echo "core.hooksPath=$(git -C "$APP_DIR" config --local --get core.hooksPath || echo '<unset>')"; ls -l "$LOCK_DIR/reference-transaction" 2>&1;;
esac

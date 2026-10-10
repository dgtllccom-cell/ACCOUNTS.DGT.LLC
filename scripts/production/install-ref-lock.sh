#!/usr/bin/env bash
# Installs / removes the live-checkout ref lock.   install-ref-lock.sh install|remove   (run on the VPS as root; needs the owner's approval)
set -euo pipefail
APP_DIR="${APP_DIR:-/var/www/dgt-nextjs}"; SRC="$(cd "$(dirname "$0")" && pwd)"
case "${1:-install}" in
  install) install -m 755 "$SRC/ref-lock-hook.sh" "$APP_DIR/.git/hooks/reference-transaction"; echo "ref lock installed";;
  remove)  rm -f "$APP_DIR/.git/hooks/reference-transaction"; echo "ref lock removed";;
esac

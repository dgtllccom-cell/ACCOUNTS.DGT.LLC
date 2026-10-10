#!/bin/sh
# git "reference-transaction" hook for the LIVE checkout (/var/www/dgt-nextjs/.git/hooks/reference-transaction).
# Moving the live branch / HEAD (git pull, reset --hard, checkout, merge, rebase …) is refused unless the controlled gate (dgt-deploy) is running
# and has set DGT_DEPLOY_GATE=1. Fetching (refs/remotes/*) stays allowed. Remove the file to undo.
[ "$1" = "prepared" ] || exit 0
[ "$DGT_DEPLOY_GATE" = "1" ] && exit 0
while read -r old new ref; do
  case "$ref" in
    HEAD|refs/heads/*)
      echo "" >&2
      echo "✗ REFUSED: the live server's code can only be changed through the controlled gate (dgt-deploy) after the owner's approval." >&2
      echo "  ($ref $old -> $new)  See docs/production-deployment-control.md" >&2
      exit 1 ;;
  esac
done
exit 0

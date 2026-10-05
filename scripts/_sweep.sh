#!/bin/bash
# DEV-only responsive sweep: every page x devices x themes x langs. Usage: _sweep.sh OUTDIR LANGS DEVICES SEGMENTS pages...
export MSYS_NO_PATHCONV=1
OUTDIR=$1; LANGS=$2; DEVICES=$3; SEG=$4; shift 4
for P in "$@"; do
  KEY=$(echo "$P" | sed 's#^/dashboard/##; s#[/?=&]#_#g')
  RBAC_SECRET=C:/Users/dgtll/AppData/Local/Temp/claude/B--accounts-dgt-llc-code-project/2834159b-a2a0-4728-a0d2-4876b08db123/scratchpad/_rbac_secret.json BASE=${BASE:-http://localhost:3230} OUT=$OUTDIR/$KEY PAGE_PATH=$P KEY=$KEY MODES=after THEMES=day,night LANGS=$LANGS DEVICES=$DEVICES SEGMENTS=$SEG node scripts/design-review-safari.mjs > $OUTDIR/$KEY.log 2>&1
  echo "$P: $(grep 'AFTER RESULT' $OUTDIR/$KEY.log)"
done

#!/bin/bash
# DEV-only: run the Users Page matrix in 4 parallel device groups. Usage: _par.sh OUTDIR PAGE
export MSYS_NO_PATHCONV=1
OUT=$1; P=$2; KEY=$(echo "$P" | sed 's#^/dashboard/##; s#[/?=&]#_#g'); mkdir -p $OUT
SEC=C:/Users/dgtll/AppData/Local/Temp/claude/B--accounts-dgt-llc-code-project/2834159b-a2a0-4728-a0d2-4876b08db123/scratchpad/_rbac_secret.json
i=0
for G in iphone-se,iphone15,iphone17promax iphone17promax-land,samsung-s,huawei-p ipad-portrait,ipad-landscape android-tab-portrait,android-tab-landscape; do
  i=$((i+1))
  WAIT_SELECTOR="${WAIT_SELECTOR:-}" RBAC_SECRET=$SEC BASE=http://localhost:3230 OUT=$OUT/$KEY-g$i PAGE_PATH=$P KEY=$KEY MODES=after THEMES=day,night LANGS=en,ur,ar,fa,ps DEVICES=$G SEGMENTS=1 node scripts/design-review-safari.mjs > $OUT/$KEY-g$i.log 2>&1 &
done
wait
grep -h "AFTER RESULT" $OUT/$KEY-g*.log
grep -h -E "ISSUE|CASE-RETRY" $OUT/$KEY-g*.log
echo PAR-DONE

#!/bin/bash
# DEV-only: launch the final full-matrix sweep (priority-ordered routes) on N shards. Usage: _launch-final.sh [SHARDS=4]
export MSYS_NO_PATHCONV=1
R=C:/Users/dgtll/AppData/Local/Temp/rs
SEC=C:/Users/dgtll/AppData/Local/Temp/claude/B--accounts-dgt-llc-code-project/2834159b-a2a0-4728-a0d2-4876b08db123/scratchpad/_rbac_secret.json
N=${1:-4}
mkdir -p $R/full2; date +%Y-%m-%dT%H:%M:%S >> $R/full2/started.txt
cd /b/accounts.dgt.llc.code_project/DESIGN-PREVIEW
for ((s=0; s<N; s++)); do
  (RBAC_SECRET=$SEC ROUTES=$R/routes_ordered.txt OUT=$R/full2 SHARD=$s SHARDS=$N nohup node scripts/design-sweep2.mjs > $R/full2/shard-$s.log 2>&1 &)
done
echo "launched $N shards"

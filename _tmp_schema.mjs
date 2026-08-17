import postgres from 'postgres';
import { readFileSync } from 'node:fs';
const SCRATCH='C:/Users/dgtll/AppData/Local/Temp/claude/B--accounts-dgt-llc-code-project/77975c2c-323a-4f50-a275-0dfa016489c8/scratchpad';
const PROD=readFileSync(SCRATCH+'/vps_db.txt','utf8').trim().replace(/^DATABASE_URL=/,'').replace(/^["']|["']$/g,'');
const P=postgres(PROD,{max:1,prepare:false,idle_timeout:6,connect_timeout:20});
for(const t of ['customers','banks','companies','ledgers','clearing_agents','purchase_orders']){
  const c=(await P.unsafe(`select column_name from information_schema.columns where table_name='${t}' order by ordinal_position`)).map(r=>r.column_name);
  console.log(t+':', c.join(', '));
}
await P.end();

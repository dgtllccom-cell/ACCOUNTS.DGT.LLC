import postgres from 'postgres';
import { readFileSync } from 'node:fs';
const SCRATCH='C:/Users/dgtll/AppData/Local/Temp/claude/B--accounts-dgt-llc-code-project/77975c2c-323a-4f50-a275-0dfa016489c8/scratchpad';
const PROD=readFileSync(SCRATCH+'/vps_db.txt','utf8').trim().replace(/^DATABASE_URL=/,'').replace(/^["']|["']$/g,'');
async function q(sql){for(let i=0;i<3;i++){const P=postgres(PROD,{max:1,prepare:false,idle_timeout:6,connect_timeout:20});try{const r=await P.unsafe(sql);await P.end();return r;}catch(e){await P.end().catch(()=>{});if(i===2)throw e;await new Promise(s=>setTimeout(s,1500));}}}
const r=await q(`select coalesce(entry_category,'<NULL>') cat, coalesce(source_module,'<NULL>') sm, count(*)::int c from roznamcha_entries where deleted_at is null group by 1,2 order by 3 desc limit 20`);
for(const row of r) console.log(`  entry_category=${row.cat} | source_module=${row.sm} => ${row.c}`);

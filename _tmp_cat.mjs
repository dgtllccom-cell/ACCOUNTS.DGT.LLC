import postgres from 'postgres';
import { readFileSync } from 'node:fs';
const SCRATCH='C:/Users/dgtll/AppData/Local/Temp/claude/B--accounts-dgt-llc-code-project/77975c2c-323a-4f50-a275-0dfa016489c8/scratchpad';
const PROD=readFileSync(SCRATCH+'/vps_db.txt','utf8').trim().replace(/^DATABASE_URL=/,'').replace(/^["']|["']$/g,'');
async function q(sql){for(let i=0;i<3;i++){const P=postgres(PROD,{max:1,prepare:false,idle_timeout:6,connect_timeout:20});try{const r=await P.unsafe(sql);await P.end();return r;}catch(e){await P.end().catch(()=>{});if(i===2)throw e;await new Promise(s=>setTimeout(s,1500));}}}
console.log('=== distinct entry_category (prod, non-deleted) ===');
const cats=await q(`select coalesce(entry_category,'<NULL>') cat, count(*)::int c from roznamcha_entries where deleted_at is null group by 1 order by 2 desc`);
for(const r of cats) console.log(`  ${r.cat}: ${r.c}`);
console.log('=== distinct type ===');
const types=await q(`select coalesce(type,'<NULL>') t, count(*)::int c from roznamcha_entries where deleted_at is null group by 1 order by 2 desc`);
for(const r of types) console.log(`  ${r.t}: ${r.c}`);
console.log('=== source_module distribution ===');
const sm=await q(`select coalesce(source_module,'<NULL>') s, count(*)::int c from roznamcha_entries where deleted_at is null group by 1 order by 2 desc limit 15`);
for(const r of sm) console.log(`  ${r.s}: ${r.c}`);

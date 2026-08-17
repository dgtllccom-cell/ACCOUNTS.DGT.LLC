import postgres from 'postgres';
import { readFileSync } from 'node:fs';
const SCRATCH='C:/Users/dgtll/AppData/Local/Temp/claude/B--accounts-dgt-llc-code-project/77975c2c-323a-4f50-a275-0dfa016489c8/scratchpad';
const PROD=readFileSync(SCRATCH+'/vps_db.txt','utf8').trim().replace(/^DATABASE_URL=/,'').replace(/^["']|["']$/g,'');
async function q(sql){for(let i=0;i<4;i++){const P=postgres(PROD,{max:1,prepare:false,idle_timeout:6,connect_timeout:20});try{const r=await P.unsafe(sql);await P.end();return r;}catch(e){await P.end().catch(()=>{});if(i===3)throw e;await new Promise(s=>setTimeout(s,1500));}}}
// Which posting tables actually carry rows, and do journal_lines reconcile to ledger totals?
for(const t of ['journal_entries','journal_lines','ledger_entries','ledger_posting_lines','transactions','roznamcha_lines','roznamcha_entries']){
  try{ console.log(t, '=', (await q(`select count(*)::int c from ${t}`))[0].c); }catch(e){ console.log(t,'ERR',e.message.slice(0,40)); }
}
console.log('=== ledger_entries columns ===');
console.log((await q(`select column_name from information_schema.columns where table_name='ledger_entries' order by ordinal_position`)).map(r=>r.column_name).join(', '));
// GLOBAL double-entry balance across the authoritative journal_lines
const jl=(await q(`select column_name from information_schema.columns where table_name='journal_lines'`)).map(r=>r.column_name);
console.log('journal_lines cols:', jl.join(', '));

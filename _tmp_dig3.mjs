import postgres from 'postgres';
import { readFileSync } from 'node:fs';
const SCRATCH='C:/Users/dgtll/AppData/Local/Temp/claude/B--accounts-dgt-llc-code-project/77975c2c-323a-4f50-a275-0dfa016489c8/scratchpad';
const PROD=readFileSync(SCRATCH+'/vps_db.txt','utf8').trim().replace(/^DATABASE_URL=/,'').replace(/^["']|["']$/g,'');
async function q(sql){for(let i=0;i<4;i++){const P=postgres(PROD,{max:1,prepare:false,idle_timeout:6,connect_timeout:20});try{const r=await P.unsafe(sql);await P.end();return r;}catch(e){await P.end().catch(()=>{});if(i===3)throw e;await new Promise(s=>setTimeout(s,1500));}}}
const ecols=(await q(`select column_name from information_schema.columns where table_name='roznamcha_entries' order by ordinal_position`)).map(r=>r.column_name);
console.log('roznamcha_entries cols:', ecols.join(', '));
console.log('=== all 6 roznamcha entries w/ status + posted flag ===');
const statusCol=['status','posting_status','is_posted','posted','state'].find(c=>ecols.includes(c));
const rows=await q(`select e.id, e.created_at::date d, ${ecols.includes('reference_no')?'e.reference_no':(ecols.includes('entry_no')?'e.entry_no':'null')} ref, ${statusCol?('e.'+statusCol):'null'} status,
   (select sum(debit) from roznamcha_lines l where l.roznamcha_entry_id=e.id) dr,
   (select sum(credit) from roznamcha_lines l where l.roznamcha_entry_id=e.id) cr
   from roznamcha_entries e order by e.created_at`);
for(const r of rows) console.log(JSON.stringify(r));
console.log('=== the 367500 line(s) + parent entry ===');
const l=await q(`select l.roznamcha_entry_id, l.ledger_id, g.name lname, g.code, l.debit, l.credit, ${statusCol?('e.'+statusCol):'null'} estatus, e.created_at::date
  from roznamcha_lines l join ledgers g on g.id=l.ledger_id join roznamcha_entries e on e.id=l.roznamcha_entry_id
  where l.debit=367500 or l.credit=367500 order by l.roznamcha_entry_id`);
for(const r of l) console.log(JSON.stringify(r));

import postgres from 'postgres';
import { readFileSync } from 'node:fs';
const SCRATCH='C:/Users/dgtll/AppData/Local/Temp/claude/B--accounts-dgt-llc-code-project/77975c2c-323a-4f50-a275-0dfa016489c8/scratchpad';
const PROD=readFileSync(SCRATCH+'/vps_db.txt','utf8').trim().replace(/^DATABASE_URL=/,'').replace(/^["']|["']$/g,'');
async function q(sql){for(let i=0;i<4;i++){const P=postgres(PROD,{max:1,prepare:false,idle_timeout:6,connect_timeout:20});try{const r=await P.unsafe(sql);await P.end();return r;}catch(e){await P.end().catch(()=>{});if(i===3)throw e;await new Promise(s=>setTimeout(s,1500));}}}
console.log('=== duplicate customer(s) ===');
const dc=await q(`select customer_name,country_id,count(*) c, array_agg(id::text) ids, array_agg(coalesce(mobile,'')) mob, array_agg(coalesce(company_name,'')) comp, array_agg(created_at::text) cre from customers where deleted_at is null group by customer_name,country_id having count(*)>1`);
for(const r of dc) console.log(JSON.stringify(r));
console.log('=== 4 ledgers: stored totals vs roznamcha-line sums ===');
const lm=await q(`
  select g.name, g.code, g.currency, g.opening_balance ob, g.debit_total dt, g.credit_total ct, g.current_balance cb, g.normal_balance nb,
         coalesce(s.dr,0) line_dr, coalesce(s.cr,0) line_cr, coalesce(s.n,0) nlines
  from ledgers g
  left join (select ledger_id, sum(debit) dr, sum(credit) cr, count(*) n from roznamcha_lines group by ledger_id) s on s.ledger_id=g.id
  where g.deleted_at is null
    and (coalesce(g.debit_total,0) <> coalesce(s.dr,0) or coalesce(g.credit_total,0) <> coalesce(s.cr,0))
  order by g.name`);
for(const r of lm) console.log(JSON.stringify(r));
console.log('=== do these ledgers receive postings from non-roznamcha sources? (journal_entries / journal_lines tables?) ===');
console.log('tables like %journal% or %posting%:', (await q(`select table_name from information_schema.tables where table_schema='public' and (table_name ilike '%journal%' or table_name ilike '%posting%' or table_name ilike '%ledger_entr%' or table_name ilike '%transaction%') order by 1`)).map(r=>r.table_name).join(', '));

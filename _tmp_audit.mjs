import postgres from 'postgres';
import { readFileSync } from 'node:fs';
const SCRATCH='C:/Users/dgtll/AppData/Local/Temp/claude/B--accounts-dgt-llc-code-project/77975c2c-323a-4f50-a275-0dfa016489c8/scratchpad';
const PROD=readFileSync(SCRATCH+'/vps_db.txt','utf8').trim().replace(/^DATABASE_URL=/,'').replace(/^["']|["']$/g,'');
async function q(sql){for(let i=0;i<4;i++){const P=postgres(PROD,{max:1,prepare:false,idle_timeout:6,connect_timeout:20});try{const r=await P.unsafe(sql);await P.end();return r;}catch(e){await P.end().catch(()=>{});if(i===3)throw e;await new Promise(s=>setTimeout(s,1500));}}}
const one=async s=>(await q(s))[0];
const A={};
// ORPHANS / BROKEN FK
A.orphan_roznamcha_lines = (await one(`select count(*)::int c from roznamcha_lines l left join roznamcha_entries e on e.id=l.roznamcha_entry_id where e.id is null`)).c;
A.roznamcha_lines_bad_ledger = (await one(`select count(*)::int c from roznamcha_lines l where l.ledger_id is not null and not exists(select 1 from ledgers g where g.id=l.ledger_id)`)).c;
A.accounts_bad_company = (await one(`select count(*)::int c from enterprise_accounts a where a.company_id is not null and not exists(select 1 from companies c where c.id=a.company_id)`)).c;
A.accounts_bad_customer = (await one(`select count(*)::int c from enterprise_accounts a where a.customer_id is not null and not exists(select 1 from customers c where c.id=a.customer_id)`)).c;
A.accounts_bad_bank = (await one(`select count(*)::int c from enterprise_accounts a where a.bank_id is not null and not exists(select 1 from banks b where b.id=a.bank_id)`)).c;
A.ledgers_bad_account = (await one(`select count(*)::int c from ledgers g where g.account_id is not null and not exists(select 1 from enterprise_accounts a where a.id=g.account_id)`)).c;
A.po_bad_supplier = (await one(`select count(*)::int c from purchase_orders p where p.supplier_company_id is not null and not exists(select 1 from companies c where c.id=p.supplier_company_id)`)).c;
// MISSING NAMES
A.accounts_blank_name = (await one(`select count(*)::int c from enterprise_accounts where deleted_at is null and (name is null or trim(name)='')`)).c;
A.companies_blank_name = (await one(`select count(*)::int c from companies where deleted_at is null and (name is null or trim(name)='')`)).c;
A.customers_blank_name = (await one(`select count(*)::int c from customers where deleted_at is null and (customer_name is null or trim(customer_name)='')`)).c;
A.banks_blank_name = (await one(`select count(*)::int c from banks where deleted_at is null and (bank_name is null or trim(bank_name)='')`)).c;
A.ledgers_blank_name = (await one(`select count(*)::int c from ledgers where deleted_at is null and (name is null or trim(name)='')`)).c;
// DUPLICATES (real masters)
A.dup_accounts_by_code = (await q(`select code from enterprise_accounts where deleted_at is null and code is not null and trim(code)<>'' group by code having count(*)>1`)).length;
A.dup_customers = (await q(`select 1 from customers where deleted_at is null group by lower(trim(customer_name)),country_id having count(*)>1`)).length;
A.dup_banks = (await q(`select 1 from banks where deleted_at is null group by lower(trim(bank_name)),coalesce(account_number,'') having count(*)>1`)).length;
A.dup_ledger_code = (await q(`select code from ledgers where deleted_at is null and code is not null and trim(code)<>'' group by code having count(*)>1`)).length;
// LEDGER RECONCILIATION: ledger.debit_total/credit_total vs sum of posted roznamcha_lines
A.ledger_recon_mismatches = (await q(`
  select g.id, g.name, g.debit_total, g.credit_total,
         coalesce(s.dr,0) sdr, coalesce(s.cr,0) scr
  from ledgers g
  left join (select ledger_id, sum(debit) dr, sum(credit) cr from roznamcha_lines group by ledger_id) s on s.ledger_id=g.id
  where g.deleted_at is null
    and (coalesce(g.debit_total,0) <> coalesce(s.dr,0) or coalesce(g.credit_total,0) <> coalesce(s.cr,0))`)).length;
// LEDGER balance consistency: current_balance vs opening + signed(dr,cr) by normal_balance
A.ledger_balance_mismatches = (await q(`
  select g.id from ledgers g where g.deleted_at is null
  and round(coalesce(g.current_balance,0),2) <> round(
      coalesce(g.opening_balance,0) + case when g.normal_balance='credit'
        then coalesce(g.credit_total,0)-coalesce(g.debit_total,0)
        else coalesce(g.debit_total,0)-coalesce(g.credit_total,0) end,2)`)).length;
for(const t of ['countries','country_branches','city_branches','clearing_agents','purchase_orders']) A['n_'+t]=(await one(`select count(*)::int c from ${t}`)).c;
console.log(JSON.stringify(A,null,1));

import postgres from 'postgres';
import { readFileSync } from 'node:fs';
const SCRATCH='C:/Users/dgtll/AppData/Local/Temp/claude/B--accounts-dgt-llc-code-project/77975c2c-323a-4f50-a275-0dfa016489c8/scratchpad';
const PROD=readFileSync(SCRATCH+'/vps_db.txt','utf8').trim().replace(/^DATABASE_URL=/,'').replace(/^["']|["']$/g,'');
async function q(sql){for(let i=0;i<3;i++){const P=postgres(PROD,{max:1,prepare:false,idle_timeout:6,connect_timeout:20});try{const r=await P.unsafe(sql);await P.end();return r;}catch(e){await P.end().catch(()=>{});if(i===2)throw e;await new Promise(s=>setTimeout(s,1500));}}}
const show=async(label,sql)=>{console.log('=== '+label+' ===');const r=await q(sql);for(const row of r)console.log('  '+JSON.stringify(row));};
await show('type (text)', `select type::text t, count(*)::int c from roznamcha_entries where deleted_at is null group by 1 order by 2 desc`);
await show('source_module', `select coalesce(source_module,'<NULL>') s, count(*)::int c from roznamcha_entries where deleted_at is null group by 1 order by 2 desc limit 12`);
await show('source_transaction_type', `select coalesce(source_transaction_type,'<NULL>') s, count(*)::int c from roznamcha_entries where deleted_at is null group by 1 order by 2 desc limit 12`);
await show('line payment_entry_type', `select coalesce(payment_entry_type,'<NULL>') p, count(*)::int c from roznamcha_lines group by 1 order by 2 desc limit 15`);
await show('entry_category x type cross', `select entry_category, type::text, count(*)::int c from roznamcha_entries where deleted_at is null group by 1,2 order by 3 desc limit 15`);

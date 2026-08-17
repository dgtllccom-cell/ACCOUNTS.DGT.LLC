import postgres from 'postgres';
import { readFileSync } from 'node:fs';
const url=process.env.DATABASE_URL||'';
const ref=(()=>{try{const u=new URL(url);const usr=decodeURIComponent(u.username);return usr.includes('.')?usr.split('.').slice(1).join('.'):usr;}catch{return '';}})();
if(ref.startsWith('inmayhrx')){console.error('ABORT: production project');process.exit(1);}
if(!ref.startsWith('csesvyxx')){console.error('ABORT: not local/dev csesvyxx (got '+ref+')');process.exit(1);}
console.log('Target:', ref, '(local/dev OK)');
const s=postgres(url,{max:1,prepare:false,idle_timeout:8,connect_timeout:12});
try{ await s.unsafe(readFileSync('supabase/migrations/20260819_shipping_intercountry_transfer.sql','utf8')); console.log('MIGRATION APPLIED OK'); }
catch(e){ console.error('MIGRATION ERROR:', e.message); await s.end(); process.exit(1); }
const cols=(await s.unsafe("select column_name from information_schema.columns where table_name='shipping_expense_transfers' order by ordinal_position")).map(r=>r.column_name);
console.log('shipping_expense_transfers columns:', cols.length, '->', cols.join(','));
await s.end();

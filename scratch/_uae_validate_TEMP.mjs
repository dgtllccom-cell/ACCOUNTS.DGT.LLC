import fs from "node:fs";
import postgres from "postgres";
function pe(f){const e={};if(!fs.existsSync(f))return e;for(const l of fs.readFileSync(f,"utf8").split(/\r?\n/)){const t=l.trim();if(!t||t.startsWith("#"))continue;const i=t.indexOf("=");if(i<0)continue;e[t.slice(0,i)]=t.slice(i+1).replace(/^"|"$/g,"")}return e}
const env={...pe(".env"),...pe(".env.local")};
const FILES = process.argv.slice(2);
if(!FILES.length){console.error("usage: node _uae_validate_TEMP.mjs <mig1.sql> [mig2.sql...]");process.exit(1)}
const sql=postgres(env.DATABASE_URL,{max:1,prepare:false,connect_timeout:60});
const SENT="__rollback__";
try{
  await sql.begin(async(tx)=>{
    for(const f of FILES){
      let body=fs.readFileSync(f,"utf8");
      body=body.replace(/^\s*BEGIN;\s*$/m,"").replace(/^\s*COMMIT;\s*$/m,"").replace(/^\s*NOTIFY[^;]*;\s*$/m,"");
      await tx.unsafe(body);
      console.log("  applied:",f);
    }
    const t=await tx`SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name LIKE 'uae_%' ORDER BY 1`;
    const fns=await tx`SELECT routine_name FROM information_schema.routines WHERE routine_schema='public' AND (routine_name LIKE 'uae_%' OR routine_name LIKE 'sync_uae%' OR routine_name LIKE 'get_uae%' OR routine_name LIKE 'trg_uae%') ORDER BY 1`;
    console.log("TABLES/VIEWS:",t.map(r=>r.table_name).join(", "));
    console.log("FUNCTIONS:",fns.map(r=>r.routine_name).join(", "));
    // exercise the sync entry point (no UAE entity -> zero rows, but proves SQL runs)
    const s=await tx`SELECT * FROM public.sync_uae_tax_all(NULL,NULL)`;
    console.log("sync_uae_tax_all():",JSON.stringify(s));
    const soi=await tx`SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='sales_order_items' ORDER BY ordinal_position`;
    console.log("sales_order_items cols:",soi.map(r=>r.column_name).join(","));
    const poi=await tx`SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='purchase_order_items' AND column_name IN ('is_taxable','vat_rate','vat_amount','taxable_amount','tax_code_id')`;
    console.log("purchase_order_items new cols:",poi.map(r=>r.column_name).join(","));
    throw new Error(SENT);
  });
}catch(e){
  if(e.message===SENT){console.log("\n✓ VALIDATION PASSED — rolled back, nothing persisted.");await sql.end();process.exit(0)}
  console.error("\n✗ FAILED:",e.message);console.error(e);await sql.end();process.exit(1);
}

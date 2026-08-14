import fs from "node:fs";
import postgres from "postgres";
function pe(f){const e={};if(!fs.existsSync(f))return e;for(const l of fs.readFileSync(f,"utf8").split(/\r?\n/)){const t=l.trim();if(!t||t.startsWith("#"))continue;const i=t.indexOf("=");if(i>-1)e[t.slice(0,i)]=t.slice(i+1).replace(/^"|"$/g,"");}return e;}
const env={...pe(".env"),...pe(".env.local")};
const local=postgres(env.DATABASE_URL,{max:1,prepare:false,connect_timeout:30});
const vps=postgres("postgresql://postgres.inmayhrxucimxqhgseqi:9z2_v5b6oZKPrbwoEL-z6awkg53gPDmPf3_pNFbSFsSVQdDk@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres",{max:1,prepare:false,connect_timeout:30});

// FK constraints on city_branches (from VPS)
const fks = await vps.unsafe(`
  select kcu.column_name, ccu.table_name as ref_table, ccu.column_name as ref_col
  from information_schema.table_constraints tc
  join information_schema.key_column_usage kcu on tc.constraint_name=kcu.constraint_name
  join information_schema.constraint_column_usage ccu on tc.constraint_name=ccu.constraint_name
  where tc.table_name='city_branches' and tc.constraint_type='FOREIGN KEY'`);
console.log("city_branches FKs on VPS:", JSON.stringify(fks));

// Sample LOCAL city_branches parent refs and test existence on VPS
const sample = await local.unsafe(`select id, country_id, country_branch_id, city_id from public.city_branches limit 5`).catch(e=>({error:e.message}));
console.log("\nLOCAL city_branches sample:", JSON.stringify(sample, null, 1));

for (const col of ["country_id","country_branch_id","city_id"]) {
  try {
    const ids = await local.unsafe(`select distinct "${col}" as v from public.city_branches where "${col}" is not null`);
    const vals = ids.map(r=>r.v);
    if (vals.length===0){ console.log(`${col}: no values`); continue; }
    // how many of these exist on VPS?
    const reftable = fks.find(f=>f.column_name===col)?.ref_table;
    if (!reftable){ console.log(`${col}: no FK ref table`); continue; }
    const present = await vps.unsafe(`select count(*)::int c from public."${reftable}" where id = any($1::uuid[])`, [vals]);
    console.log(`${col} -> ${reftable}: LOCAL distinct=${vals.length}, existing on VPS=${present[0].c}`);
  } catch(e){ console.log(`${col}: err ${e.message.slice(0,60)}`); }
}
process.exit(0);

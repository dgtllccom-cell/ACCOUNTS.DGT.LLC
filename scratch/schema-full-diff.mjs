import fs from "node:fs"; import postgres from "postgres";
const DEV = fs.readFileSync(".env.local","utf8").split(/\r?\n/).find(l=>l.startsWith("DATABASE_URL=")).slice(13).replace(/^"|"$/g,"");
const d = postgres(DEV,{max:1,prepare:false});
const r = postgres("postgresql://postgres:scratchpwd@127.0.0.1:5433/prod_replica",{max:1,prepare:false});

// COLUMN diff on shared tables
const colQ = `SELECT table_name||'.'||column_name k, data_type||coalesce(' '||character_maximum_length,'') t
  FROM information_schema.columns WHERE table_schema='public'`;
const devC = new Map((await d.unsafe(colQ)).map(x=>[x.k,x.t]));
const repC = new Map((await r.unsafe(colQ)).map(x=>[x.k,x.t]));
const repTables = new Set((await r`SELECT table_name FROM information_schema.tables WHERE table_schema='public'`).map(x=>x.table_name));
const isCruft = t => /^zz_bak/.test(t) || /_(ar|en|fa|ps|ur)(_(ar|en|fa|ps|ur))?$/.test(t) || /^uae_/.test(t);
const missingCols = [...devC.keys()].filter(k => {
  const tbl = k.split(".")[0];
  return repTables.has(tbl) && !isCruft(tbl) && !repC.has(k);
}).sort();
console.log(`Missing COLUMNS on shared non-cruft tables: ${missingCols.length}`);
missingCols.forEach(k=>console.log("  +",k));

// VIEW diff
const vQ = `SELECT table_name FROM information_schema.views WHERE table_schema='public'`;
const devV = new Set((await d.unsafe(vQ)).map(x=>x.table_name));
const repV = new Set((await r.unsafe(vQ)).map(x=>x.table_name));
const missingV = [...devV].filter(v => !repV.has(v) && !isCruft(v)).sort();
console.log(`\nMissing VIEWS: ${missingV.length}`); missingV.forEach(v=>console.log("  +",v));

fs.writeFileSync("scratch/schema-diff.json", JSON.stringify({missingCols, missingV}, null, 1));
await d.end(); await r.end();

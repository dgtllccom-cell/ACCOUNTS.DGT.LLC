import { resolveDbUrl } from "./lib/prod-db-url.mjs";
import fs from "node:fs";
import postgres from "postgres";
function pe(f){const e={};if(!fs.existsSync(f))return e;for(const l of fs.readFileSync(f,"utf8").split(/\r?\n/)){const t=l.trim();if(!t||t.startsWith("#"))continue;const i=t.indexOf("=");if(i>-1)e[t.slice(0,i)]=t.slice(i+1).replace(/^"|"$/g,"");}return e;}
const env={...pe(".env"),...pe(".env.local")};
const local=postgres(env.DATABASE_URL,{max:1,prepare:false,connect_timeout:30});
const vps=postgres(resolveDbUrl("prod"),{max:1,prepare:false,connect_timeout:30});
async function common(t){const lc=await local.unsafe(`select column_name from information_schema.columns where table_schema='public' and table_name=$1`,[t]);const vc=await vps.unsafe(`select column_name from information_schema.columns where table_schema='public' and table_name=$1`,[t]);const s=new Set(vc.map(r=>r.column_name));return lc.map(r=>r.column_name).filter(c=>s.has(c));}
async function cnt(db,t){const r=await db.unsafe(`select count(*)::int c from public."${t}"`);return r[0].c;}
for (const t of ["customer_contacts"]) {
  const before=await cnt(vps,t), lc=await cnt(local,t), cols=await common(t);
  const rows=await local.unsafe(`select ${cols.map(c=>`"${c}"`).join(",")} from public."${t}"`);
  let ins=0,fk=0,oth=0;
  for (const row of rows){const vals=cols.map(c=>row[c]);const ph=cols.map((_,i)=>`$${i+1}`).join(",");
    try{const r=await vps.unsafe(`insert into public."${t}" (${cols.map(c=>`"${c}"`).join(",")}) values (${ph}) on conflict (id) do nothing`,vals);if(r.count)ins+=r.count;}
    catch(e){const m=String(e.message);if(m.includes("foreign key"))fk++;else{oth++;if(oth<=2)console.log("  err:",m.slice(0,90));}}}
  const after=await cnt(vps,t);
  console.log(`${t}: local=${lc} vpsBefore=${before} inserted=${ins} skippedFK=${fk} skippedOther=${oth} vpsAfter=${after}`);
}
process.exit(0);

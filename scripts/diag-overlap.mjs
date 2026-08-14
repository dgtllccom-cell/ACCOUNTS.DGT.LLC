import fs from "node:fs";
import postgres from "postgres";
function pe(f){const e={};if(!fs.existsSync(f))return e;for(const l of fs.readFileSync(f,"utf8").split(/\r?\n/)){const t=l.trim();if(!t||t.startsWith("#"))continue;const i=t.indexOf("=");if(i>-1)e[t.slice(0,i)]=t.slice(i+1).replace(/^"|"$/g,"");}return e;}
const env={...pe(".env"),...pe(".env.local")};
const local=postgres(env.DATABASE_URL,{max:1,prepare:false,connect_timeout:30});
const vps=postgres("postgresql://postgres.inmayhrxucimxqhgseqi:9z2_v5b6oZKPrbwoEL-z6awkg53gPDmPf3_pNFbSFsSVQdDk@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres",{max:1,prepare:false,connect_timeout:30});
for (const t of ["countries","customers","companies","banks","warehouses"]) {
  const ids = await local.unsafe(`select id from public."${t}" limit 500`);
  const vals = ids.map(r=>r.id);
  const present = await vps.unsafe(`select count(*)::int c from public."${t}" where id = any($1::uuid[])`,[vals]);
  console.log(`${t}: LOCAL sample=${vals.length}, same-ID on VPS=${present[0].c}`);
}
process.exit(0);

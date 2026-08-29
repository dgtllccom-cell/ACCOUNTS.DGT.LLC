import fs from "node:fs"; import postgres from "postgres";
const DEV = fs.readFileSync(".env.local","utf8").split(/\r?\n/).find(l=>l.startsWith("DATABASE_URL=")).slice(13).replace(/^"|"$/g,"");
const d = postgres(DEV,{max:1,prepare:false});
const r = postgres("postgresql://postgres:scratchpwd@127.0.0.1:5433/prod_replica",{max:1,prepare:false});
const Q = `SELECT p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' sig,
  md5(regexp_replace(regexp_replace(pg_get_functiondef(p.oid),'\s+',' ','g'),'  +',' ','g')) h
  FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public'`;
const dev = new Map((await d.unsafe(Q)).map(x=>[x.sig,x.h]));
const rep = new Map((await r.unsafe(Q)).map(x=>[x.sig,x.h]));
await d.end(); await r.end();
const onlyDev = [...dev.keys()].filter(k=>!rep.has(k)).sort();
const onlyRep = [...rep.keys()].filter(k=>!dev.has(k)).sort();
const differ = [...dev.keys()].filter(k=>rep.has(k) && rep.get(k)!==dev.get(k)).sort();
console.log(`DEV ${dev.size} fns | replica/prod ${rep.size} fns`);
console.log(`\n== MISSING from prod (only DEV) ${onlyDev.length} ==`); onlyDev.forEach(k=>console.log("  +",k));
console.log(`\n== prod-only (not on DEV) ${onlyRep.length} ==`); onlyRep.forEach(k=>console.log("  -",k));
console.log(`\n== body DIFFERS (prod stale) ${differ.length} ==`); differ.forEach(k=>console.log("  ~",k));
fs.writeFileSync("scratch/fn-diff-result.json", JSON.stringify({onlyDev,onlyRep,differ},null,1));

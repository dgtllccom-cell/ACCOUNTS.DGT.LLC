import fs from "node:fs"; import postgres from "postgres";
const DEV = fs.readFileSync(".env.local","utf8").split(/\r?\n/).find(l=>l.startsWith("DATABASE_URL=")).slice(13).replace(/^"|"$/g,"");
const d = postgres(DEV,{max:1,prepare:false});
const r = postgres("postgresql://postgres:scratchpwd@127.0.0.1:5433/prod_replica",{max:1,prepare:false});
const Q = `SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'`;
const dev = new Set((await d.unsafe(Q)).map(x=>x.table_name));
const rep = new Set((await r.unsafe(Q)).map(x=>x.table_name));
await d.end(); await r.end();
// exclude cruft: zz_bak*, recursive _lang_lang, and single per-language table_xx
const isCruft = t => /^zz_bak/.test(t) || /_(ar|en|fa|ps|ur)_(ar|en|fa|ps|ur)$/.test(t) || /_(ar|en|fa|ps|ur)$/.test(t);
const missing = [...dev].filter(t => !rep.has(t) && !isCruft(t)).sort();
const cruftMissing = [...dev].filter(t => !rep.has(t) && isCruft(t)).length;
console.log(`DEV real tables missing from reconciled replica (${missing.length}, +${cruftMissing} cruft excluded):`);
missing.forEach(t=>console.log("  +",t));
fs.writeFileSync("scratch/missing-tables.json", JSON.stringify(missing));

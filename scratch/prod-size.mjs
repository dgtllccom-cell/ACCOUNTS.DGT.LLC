import fs from "node:fs"; import postgres from "postgres";
const PROD = fs.readFileSync("scripts/backup-vps-db.mjs","utf8").match(/postgresql:\/\/[^\s'"]+/)[0];
const sql = postgres(PROD,{max:2,prepare:false,ssl:{rejectUnauthorized:false},connect_timeout:25});
const t = await sql`SELECT count(*)::int n FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'`;
const sz = await sql`SELECT pg_size_pretty(pg_database_size(current_database())) s`;
const big = await sql`
  SELECT relname, n_live_tup FROM pg_stat_user_tables WHERE schemaname='public' ORDER BY n_live_tup DESC LIMIT 12`;
console.log("prod public tables:", t[0].n, "| db size:", sz[0].s);
console.log("largest tables:", JSON.stringify(big));
await sql.end();

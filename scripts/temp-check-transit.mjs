import { resolveDbUrl } from "./lib/prod-db-url.mjs";
import postgres from "postgres";
const sql = postgres(resolveDbUrl("dev"), { ssl: "require" });
const rows = await sql`select id, entry_serial, goods_name, created_at from public.transit_entries where entry_serial = 'TE-TESTFIX01'`;
console.log(JSON.stringify(rows));
await sql.end();

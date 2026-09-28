import fs from "node:fs";
import postgres from "postgres";

const envFile = fs.existsSync(".env.production") ? ".env.production" : ".env";
const envText = fs.readFileSync(envFile, "utf8");
const match = envText.match(/DATABASE_URL=([^\r\n]+)/);
if (!match) {
  console.error("No DATABASE_URL found");
  process.exit(1);
}

const sql = postgres(match[1]);

async function run() {
  console.log("Applying shared HS code index migration...");
  await sql.unsafe("DROP INDEX IF EXISTS public.goods_chs_code_idx;");
  await sql.unsafe("CREATE INDEX IF NOT EXISTS goods_chs_code_idx ON public.goods USING btree (chs_code) WHERE (deleted_at IS NULL);");
  console.log("✅ Index successfully updated to standard non-unique index!");
  await sql.end();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});

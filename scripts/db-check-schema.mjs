import fs from "node:fs";
import postgres from "postgres";

const env = Object.fromEntries(
  fs.readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((line) => line.includes("=") && !line.trim().startsWith("#"))
    .map((line) => line.split("=").map((p) => p.trim()))
);

const dbUrl = env.POSTGRES_URL || env.DATABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL;
if (!dbUrl) {
  console.error("No database URL found in .env.local!");
  process.exit(1);
}

const sql = postgres(dbUrl, { ssl: "require" });

async function run() {
  try {
    const cols = await sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'goods' AND column_name = 'origin_country_id';
    `;
    console.log("goods origin_country_id column:", cols);

    const varsCols = await sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'goods_variations' AND column_name = 'origin_country_id';
    `;
    console.log("goods_variations origin_country_id column:", varsCols);

    console.log("Reloading PostgREST schema cache...");
    await sql`NOTIFY pgrst, 'reload schema';`;
    console.log("Done.");
  } catch (err) {
    console.error("Error:", err);
  } finally {
    await sql.end();
  }
}

run();

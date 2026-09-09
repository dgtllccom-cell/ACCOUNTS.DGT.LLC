import postgres from "postgres";
import fs from "fs";

let dbUrl = process.env.DATABASE_URL || process.env.PROD_DATABASE_URL;
if (!dbUrl && fs.existsSync(".env.local")) {
  const env = fs.readFileSync(".env.local", "utf8");
  const m = env.match(/DATABASE_URL=(.+)/);
  if (m) dbUrl = m[1].trim();
}
if (!dbUrl) {
  dbUrl = "postgresql://postgres.inmayhrxucimxqhgseqi:9z2_v5b6oZKPrbwoEL-z6awkg53gPDmPf3_pNFbSFsSVQdDk@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres";
}

const sql = postgres(dbUrl, {
  ssl: { rejectUnauthorized: false },
  prepare: false
});

async function main() {
  const profiles = await sql`
    SELECT id, full_name, user_code, role, employee_id, person_master_id
    FROM profiles
    WHERE person_master_id = '9043dd4e-fc83-4328-9c06-c53e258b1a2f'
       OR employee_id IN ('2f18f37a-e0f9-4745-a584-8cf78da24420', '7c4d59a6-0325-4d6d-91af-068b18aa22ea', '8e559092-ac90-41b9-9d01-a09cab8321d0')
  `;
  console.log("=== PROFILES LINKED ===");
  console.log(profiles);

  await sql.end();
}

main().catch(console.error);

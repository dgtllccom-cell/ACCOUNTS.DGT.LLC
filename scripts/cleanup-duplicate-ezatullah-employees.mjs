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
  console.log("Checking references to EMP-0004, EMP-0005, EMP-0006...");
  
  // Point any profiles referencing EMP-0004 or EMP-0005 to EMP-0006
  const updatedProfiles = await sql`
    UPDATE profiles
    SET employee_id = '8e559092-ac90-41b9-9d01-a09cab8321d0'
    WHERE employee_id IN ('2f18f37a-e0f9-4745-a584-8cf78da24420', '7c4d59a6-0325-4d6d-91af-068b18aa22ea')
    RETURNING id
  `;
  console.log("Updated profiles:", updatedProfiles.length);

  // Safely delete duplicate employee records EMP-0004 and EMP-0005
  const deleted = await sql`
    DELETE FROM employees
    WHERE id IN ('2f18f37a-e0f9-4745-a584-8cf78da24420', '7c4d59a6-0325-4d6d-91af-068b18aa22ea')
    RETURNING id, employee_code
  `;
  console.log("Deleted duplicate employees:", deleted);

  const remaining = await sql`
    SELECT id, employee_code, person_master_id, designation
    FROM employees
    WHERE person_master_id = '9043dd4e-fc83-4328-9c06-c53e258b1a2f'
  `;
  console.log("Remaining employee records for Ezatullah:", remaining);

  await sql.end();
}

main().catch(console.error);

import fs from "fs";
import postgres from "postgres";

function getUrl() {
  const env = fs.readFileSync(".env.local", "utf8");
  const m = env.match(/^DATABASE_URL\s*=\s*(.+)$/m);
  return m ? m[1].trim().replace(/^['"]|['"]$/g, "") : "";
}

async function main() {
  const sql = postgres(getUrl(), { max: 1, ssl: "require" });
  try {
    const cBranches = await sql`
      SELECT id, name, code, country_id, company_id, owner_name, owner_customer_id, owner_profile_id
      FROM public.country_branches
      WHERE deleted_at IS NULL
    `;
    console.log("Country branches:", cBranches);

    const cityBranches = await sql`
      SELECT id, name, code, country_id, country_branch_id, city_id, company_id, owner_name, owner_customer_id, owner_profile_id
      FROM public.city_branches
      WHERE deleted_at IS NULL
    `;
    console.log("City branches:", cityBranches);
  } finally {
    await sql.end();
  }
}

main().catch(console.error);

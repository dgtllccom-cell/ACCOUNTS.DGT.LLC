import postgres from 'postgres';

const devUrl = "postgresql://postgres.csesvyxxjivnkkozgopt:Gulistan%409090@aws-1-ap-southeast-2.pooler.supabase.com:5432/postgres";
const prodUrl = "postgresql://postgres.inmayhrxucimxqhgseqi:9z2_v5b6oZKPrbwoEL-z6awkg53gPDmPf3_pNFbSFsSVQdDk@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres";

async function applyMigration(name, url) {
  const sql = postgres(url, { ssl: 'require' });
  try {
    console.log(`Applying branch operative fields migration to ${name}...`);
    await sql`
      ALTER TABLE public.companies
      ADD COLUMN IF NOT EXISTS country_branch_id uuid REFERENCES public.country_branches(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS city_branch_id uuid REFERENCES public.city_branches(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS is_branch_operative boolean NOT NULL DEFAULT false;
    `;
    console.log(`Successfully applied branch operative fields to ${name}!`);
  } catch (err) {
    console.error(`Error on ${name}:`, err);
  } finally {
    await sql.end();
  }
}

async function main() {
  await applyMigration("DEV", devUrl);
  await applyMigration("PROD", prodUrl);
}

main();

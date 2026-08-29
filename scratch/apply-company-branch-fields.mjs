import postgres from 'postgres';

import { resolveDbUrl } from "../scripts/lib/prod-db-url.mjs";
const devUrl = resolveDbUrl("dev");
const prodUrl = resolveDbUrl("prod");

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

// Backfills companies.company_code (COMP-000001 style) for rows created before
// the Person Master Phase 2 migration. Idempotent — only touches rows where
// company_code IS NULL. DEV-only: run manually against DATABASE_URL.
import postgres from "postgres";

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) throw new Error("DATABASE_URL is required");

async function backfill() {
  const sql = postgres(dbUrl, { ssl: "require" });
  try {
    const rows = await sql`
      SELECT id FROM public.companies
      WHERE company_code IS NULL AND deleted_at IS NULL
      ORDER BY created_at ASC
    `;
    console.log(`Found ${rows.length} company(ies) missing company_code.`);

    let assigned = 0;
    for (const row of rows) {
      const [{ code }] = await sql`SELECT next_entity_serial('global', 'GLOBAL', 'company', 'COMP') AS code`;
      await sql`
        UPDATE public.companies SET company_code = ${code}
        WHERE id = ${row.id}::uuid AND company_code IS NULL
      `;
      assigned++;
      if (assigned % 50 === 0) console.log(`  ...assigned ${assigned}/${rows.length}`);
    }

    console.log(`Done. Assigned company_code to ${assigned} row(s).`);
  } finally {
    await sql.end();
  }
}

backfill().catch((err) => {
  console.error("Backfill failed:", err);
  process.exit(1);
});

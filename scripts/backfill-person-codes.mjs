// Backfills customers.person_code (PER-000001 style) for rows created before the Person
// Master phase-1 migration. Idempotent — only touches rows where person_code IS NULL, safe
// to re-run. DEV-only: run manually against DATABASE_URL, never against the VPS/production
// connection string without separate explicit approval (see plan: no production writes this
// phase).
import postgres from "postgres";

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) throw new Error("DATABASE_URL is required");

async function backfill() {
  const sql = postgres(dbUrl, { ssl: "require" });
  try {
    const rows = await sql`
      SELECT id FROM public.customers
      WHERE person_code IS NULL AND deleted_at IS NULL
      ORDER BY created_at ASC
    `;
    console.log(`Found ${rows.length} customer(s) missing person_code.`);

    let assigned = 0;
    for (const row of rows) {
      const [{ code }] = await sql`SELECT next_entity_serial('global', 'GLOBAL', 'person', 'PER') AS code`;
      await sql`
        UPDATE public.customers SET person_code = ${code}
        WHERE id = ${row.id}::uuid AND person_code IS NULL
      `;
      assigned++;
      if (assigned % 50 === 0) console.log(`  ...assigned ${assigned}/${rows.length}`);
    }

    console.log(`Done. Assigned person_code to ${assigned} row(s).`);
  } finally {
    await sql.end();
  }
}

backfill().catch((err) => {
  console.error("Backfill failed:", err);
  process.exit(1);
});

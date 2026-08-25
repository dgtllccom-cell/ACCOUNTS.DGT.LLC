// Backfills clearing_agents.clearing_agent_code (CLA-000001 style) for rows that
// pre-date the Person Master Phase 2 migration. Idempotent. DEV-only.
// Does NOT touch the pre-existing `code` column (still read by RBAC/login-management).
import postgres from "postgres";

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) throw new Error("DATABASE_URL is required");

async function backfill() {
  const sql = postgres(dbUrl, { ssl: "require" });
  try {
    const rows = await sql`
      SELECT id FROM public.clearing_agents
      WHERE clearing_agent_code IS NULL AND deleted_at IS NULL
      ORDER BY created_at ASC
    `;
    console.log(`Found ${rows.length} clearing agent(s) missing clearing_agent_code.`);

    let assigned = 0;
    for (const row of rows) {
      const [{ code }] = await sql`SELECT next_entity_serial('global', 'GLOBAL', 'clearing_agent', 'CLA') AS code`;
      await sql`
        UPDATE public.clearing_agents SET clearing_agent_code = ${code}
        WHERE id = ${row.id}::uuid AND clearing_agent_code IS NULL
      `;
      assigned++;
    }

    console.log(`Done. Assigned clearing_agent_code to ${assigned} row(s).`);
  } finally {
    await sql.end();
  }
}

backfill().catch((err) => {
  console.error("Backfill failed:", err);
  process.exit(1);
});

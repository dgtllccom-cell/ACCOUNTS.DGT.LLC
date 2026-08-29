import { resolveDbUrl } from "../scripts/lib/prod-db-url.mjs";
import postgres from 'postgres';

const prodUrl = resolveDbUrl("prod");
const sql = postgres(prodUrl, { ssl: 'require' });

async function main() {
  try {
    const migs = await sql`
      SELECT name, status, applied_at FROM erp_schema_migrations ORDER BY name DESC LIMIT 20;
    `;
    console.table(migs);
  } catch (err) {
    console.error(err);
  } finally {
    await sql.end();
  }
}

main();

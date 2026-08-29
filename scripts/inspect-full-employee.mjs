import { resolveDbUrl } from "./lib/prod-db-url.mjs";
import postgres from 'postgres';

const sql = postgres(resolveDbUrl("prod"), {
  ssl: { rejectUnauthorized: false },
  prepare: false
});

async function testRpc() {
  const result = await sql`
    SELECT * FROM list_employees_with_relations(NULL, NULL, NULL, NULL) LIMIT 2
  `;
  console.log("list_employees_with_relations output:", JSON.stringify(result[0], null, 2));

  await sql.end();
}

testRpc().catch(console.error);

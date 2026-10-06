import postgres from "postgres";
import { resolveDbUrl } from "./lib/prod-db-url.mjs";

const sql = postgres(resolveDbUrl("prod"), { max: 1, prepare: false, connect_timeout: 15 });

try {
  console.log("=== CHECKING BRANCHES IN PROD ===");
  const branches = await sql`
    SELECT id, name, code, type, is_active, created_at 
    FROM branches 
    ORDER BY name
  `;
  console.log("Branches count:", branches.length);
  for (const b of branches) {
    console.log(`- [${b.code || "NO_CODE"}] "${b.name}" (Type: ${b.type}, ID: ${b.id})`);
  }

  console.log("\n=== SEARCHING FOR 'EXPERIMENT' OR 'X' ===");
  const matches = await sql`
    SELECT id, name, code, type, is_active 
    FROM branches 
    WHERE name ILIKE '%experiment%' OR code ILIKE '%experiment%' OR name ILIKE '% X %' OR name ILIKE 'X %' OR code ILIKE 'X%'
  `;
  console.log("Matching branches:", JSON.stringify(matches, null, 2));

} catch (err) {
  console.error("Error inspecting prod:", err);
} finally {
  await sql.end();
}

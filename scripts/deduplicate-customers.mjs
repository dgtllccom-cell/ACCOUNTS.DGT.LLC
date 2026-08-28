import fs from "node:fs";
import postgres from "postgres";

function parseEnvFile(file) {
  const env = {};
  if (!fs.existsSync(file)) return env;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index === -1) continue;
    env[trimmed.slice(0, index)] = trimmed.slice(index + 1).replace(/^"|"$/g, "");
  }
  return env;
}

const env = { ...parseEnvFile(".env"), ...parseEnvFile(".env.local") };
const sql = postgres(env.DATABASE_URL, { max: 1 });

try {
  // Find duplicates by normalized name and country
  const duplicates = await sql`
    SELECT lower(trim(customer_name)) as norm_name, country_id, count(*) as count, array_agg(id order by created_at asc) as ids
    FROM customers
    WHERE deleted_at IS NULL
    GROUP BY lower(trim(customer_name)), country_id
    HAVING count(*) > 1
  `;

  console.log("Duplicate groups found:", duplicates.length);

  for (const dup of duplicates) {
    const primaryId = dup.ids[0];
    const duplicateIds = dup.ids.slice(1);
    console.log(`Processing "${dup.norm_name}" (Keep: ${primaryId}, Duplicate: ${duplicateIds.join(", ")})`);

    // Repoint references if any
    for (const dupId of duplicateIds) {
      try {
        await sql`UPDATE employees SET person_master_id = ${primaryId} WHERE person_master_id = ${dupId}`;
      } catch (e) {}
      try {
        await sql`UPDATE companies SET owner_person_id = ${primaryId} WHERE owner_person_id = ${dupId}`;
      } catch (e) {}
      try {
        await sql`UPDATE companies SET manager_person_id = ${primaryId} WHERE manager_person_id = ${dupId}`;
      } catch (e) {}
      try {
        await sql`UPDATE company_owners SET person_id = ${primaryId} WHERE person_id = ${dupId}`;
      } catch (e) {}
      // Soft-delete duplicate
      await sql`UPDATE customers SET deleted_at = now() WHERE id = ${dupId}`;
    }
  }

  console.log("Deduplication completed successfully.");
} catch (e) {
  console.error("Error in deduplication:", e);
} finally {
  await sql.end();
}

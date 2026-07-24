import fs from "node:fs";
import postgres from "postgres";

const env = Object.fromEntries(
  fs
    .readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((line) => line.includes("=") && !line.trim().startsWith("#"))
    .map((line) => {
      const index = line.indexOf("=");
      return [line.slice(0, index), line.slice(index + 1)];
    })
);

const sql = postgres(env.DATABASE_URL, { max: 1, prepare: false });

try {
  console.log("Listing all country branches:");
  const countryBranches = await sql`
    select id, name, code, deleted_at 
    from country_branches 
    where name ilike '%chain%' or name ilike '%china%' or code ilike '%CN%'
  `;
  console.log(countryBranches);

  if (countryBranches.length > 0) {
    console.log("Deleting 'chain'/'CN' branch records...");
    for (const b of countryBranches) {
      // Hard delete or soft delete
      await sql`delete from city_branches where country_branch_id = ${b.id}`;
      await sql`delete from country_branches where id = ${b.id}`;
      console.log(`Deleted country branch ${b.id}`);
    }
  } else {
    console.log("No matching country branches found.");
  }
} catch (err) {
  console.error("Error running query:", err);
} finally {
  await sql.end();
}

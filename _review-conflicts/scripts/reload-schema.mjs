import postgres from "postgres";

async function main() {
  const sql = postgres(process.env.DATABASE_URL || "postgres://postgres:postgres@localhost:54322/postgres");
  try {
    await sql`NOTIFY pgrst, 'reload schema'`;
    console.log("Schema reloaded.");
  } catch (err) {
    console.error(err);
  } finally {
    await sql.end();
  }
}
main();

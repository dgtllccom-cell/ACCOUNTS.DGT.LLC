import fs from "node:fs";
import postgres from "postgres";

function loadEnv() {
  return Object.fromEntries(
    fs
      .readFileSync(".env.local", "utf8")
      .split(/\r?\n/)
      .filter((line) => line.includes("=") && !line.trim().startsWith("#"))
      .map((line) => {
        const index = line.indexOf("=");
        return [line.slice(0, index), line.slice(index + 1)];
      })
  );
}

const env = loadEnv();
if (!env.DATABASE_URL) {
  console.error("DATABASE_URL is not set in .env.local");
  process.exit(1);
}

const sql = postgres(env.DATABASE_URL, { max: 1, prepare: false, connect_timeout: 15 });

try {
  const rows = await sql.unsafe(`
    select
      cb.id,
      cb.name,
      cb.city_name,
      cb.code,
      cb.local_currency,
      cb.country_branch_id,
      c.name as country_name
    from city_branches cb
    join countries c on c.id = cb.country_id
    where lower(cb.city_name) = lower('Quetta')
      and cb.deleted_at is null
    order by cb.created_at desc
    limit 10
  `);

  console.log(JSON.stringify(rows, null, 2));
} catch (error) {
  console.error(error?.message || error);
  process.exit(1);
} finally {
  await sql.end();
}


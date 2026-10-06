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

const sql = postgres(env.DATABASE_URL, { max: 1, prepare: false, connect_timeout: 15 });

async function run() {
  const profileCols = await sql`
    select column_name from information_schema.columns where table_name = 'profiles' order by ordinal_position
  `;
  console.log("PROFILES COLS:", profileCols.map(c => c.column_name).join(", "));

  const users = await sql`select id, email, created_at from auth.users order by created_at desc`;
  const profiles = await sql`select * from profiles where deleted_at is null`;
  const countries = await sql`select id, name, iso2, currency_code from countries where deleted_at is null order by name`;

  console.log("\n=== COUNTRIES ===");
  for (const c of countries) {
    console.log(`- ${c.name} (${c.iso2}) - ID: ${c.id}`);
  }

  console.log("\n=== AUTH USERS & PROFILES ===");
  for (const u of users) {
    const prof = profiles.find(p => p.id === u.id);
    console.log(`User: ${u.email} | ID: ${u.id}`);
    if (prof) {
      console.log(`  Profile:`, JSON.stringify(prof, (k, v) => k === 'avatar_url' ? undefined : v, 2));
    } else {
      console.log(`  No profile found!`);
    }
  }

  console.log("\n=== OTHER PROFILES ===");
  for (const p of profiles) {
    if (!users.some(u => u.id === p.id)) {
      console.log(`Profile without auth user:`, JSON.stringify(p, (k, v) => k === 'avatar_url' ? undefined : v, 2));
    }
  }

  await sql.end();
}

run().catch(console.error);

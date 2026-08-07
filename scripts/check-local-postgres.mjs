import fs from "node:fs";
import postgres from "postgres";

function loadEnv() {
  const env = {};
  try {
    for (const line of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const index = trimmed.indexOf("=");
      if (index === -1) continue;
      env[trimmed.slice(0, index)] = trimmed.slice(index + 1).replace(/^"|"$/g, "");
    }
  } catch (e) {}
  return env;
}

const env = loadEnv();

const candidates = [
  "postgresql://postgres:postgres@localhost:5432/postgres",
  "postgresql://postgres:root@localhost:5432/postgres",
  "postgresql://postgres:admin@localhost:5432/postgres",
  "postgresql://postgres:Gulistan%409090@localhost:5432/postgres",
  "postgresql://postgres:123456@localhost:5432/postgres",
  env.DATABASE_URL
].filter(Boolean);

async function checkLocal() {
  console.log("=======================================================================");
  console.log("  POSTGRESQL LOCAL INSTALLATION CHECKER");
  console.log("=======================================================================\n");

  let connected = false;

  for (const url of candidates) {
    const isLocalhost = url.includes("localhost") || url.includes("127.0.0.1");
    const maskedUrl = url.replace(/:([^:@]+)@/, ":****@");
    console.log(`▶ Testing Connection: ${maskedUrl}`);

    try {
      const sql = postgres(url, { max: 1, prepare: false, connect_timeout: 3 });
      const versionRes = await sql`select version()`;
      const versionStr = versionRes[0]?.version || "PostgreSQL";
      
      console.log(`  ✅ SUCCESS! Connected to: ${isLocalhost ? "LOCAL POSTGRESQL" : "REMOTE POSTGRESQL"}`);
      console.log(`  • Version: ${versionStr.slice(0, 70)}...\n`);
      connected = true;
      await sql.end();
      if (isLocalhost) break;
    } catch (err) {
      console.log(`  ❌ Connection failed: ${err.message || String(err)}\n`);
    }
  }

  console.log("=======================================================================");
  if (connected) {
    console.log("  🎉 RESULT: POSTGRESQL IS INSTALLED & RUNNING!");
  } else {
    console.log("  ⚠️ RESULT: LOCAL POSTGRESQL IS NOT YET RUNNING ON PORT 5432.");
    console.log("  • If you just installed PostgreSQL, check Windows Services for 'postgresql-x64-16'.");
  }
  console.log("=======================================================================");
}

checkLocal();

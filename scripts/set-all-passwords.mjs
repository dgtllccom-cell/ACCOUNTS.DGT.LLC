import postgres from "postgres";
import fs from "fs";

function loadEnv() {
  if (fs.existsSync(".env.local")) {
    const lines = fs.readFileSync(".env.local", "utf8").split(/\r?\n/);
    for (const line of lines) {
      if (line.trim().startsWith("DATABASE_URL=")) {
        process.env.DATABASE_URL = line.slice(line.indexOf("=") + 1).trim();
      }
    }
  }
}
loadEnv();

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.error("No DATABASE_URL found");
  process.exit(1);
}

const NEW_PASSWORD = "Chaman@9090";

async function run() {
  console.log("==========================================================");
  console.log("CONFIRMING DATABASE CONNECTION FOR PASSWORD UPDATE");
  console.log("URL:", dbUrl.replace(/:[^:@]+@/, ":***@"));
  
  if (dbUrl.includes("csesvyxxjivnkkozgopt")) {
    console.log("TARGET: Testing / Development DB (csesvyxxjivnkkozgopt)");
  } else if (dbUrl.includes("inmayhrxucimxqhgseqi")) {
    console.log("TARGET: Production DB (inmayhrxucimxqhgseqi)");
  } else {
    console.log("TARGET: Other database");
  }
  console.log("==========================================================\n");

  const sql = postgres(dbUrl, { max: 1 });

  // 1. Ensure pgcrypto
  await sql`CREATE EXTENSION IF NOT EXISTS pgcrypto;`;

  // 2. Update auth.users for active users
  const authRes = await sql`
    UPDATE auth.users
    SET encrypted_password = crypt(${NEW_PASSWORD}, gen_salt('bf')),
        email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
        banned_until = NULL,
        updated_at = NOW()
    WHERE deleted_at IS NULL;
  `;
  console.log("Updated auth.users count:", authRes.count);

  // 3. Update public.profiles raw_password
  const profRes = await sql`
    UPDATE public.profiles
    SET raw_password = ${NEW_PASSWORD},
        updated_at = NOW()
    WHERE deleted_at IS NULL;
  `;
  console.log("Updated public.profiles count:", profRes.count);

  // 4. Verification test
  const verification = await sql`
    SELECT 
      p.user_code, 
      p.full_name, 
      u.email,
      p.raw_password,
      (u.encrypted_password = crypt(${NEW_PASSWORD}, u.encrypted_password)) as crypt_matches
    FROM public.profiles p
    JOIN auth.users u ON u.id = p.id
    WHERE p.deleted_at IS NULL
    ORDER BY p.user_code;
  `;

  console.log("\nVERIFICATION RESULTS (Total: " + verification.length + "):");
  let allMatched = true;
  for (const v of verification) {
    console.log(`- [${v.email}] code: ${v.user_code} | raw_pw: "${v.raw_password}" | crypt_matches: ${v.crypt_matches}`);
    if (!v.crypt_matches || v.raw_password !== NEW_PASSWORD) {
      allMatched = false;
    }
  }

  if (allMatched) {
    console.log(`\n SUCCESS: All active users now successfully verify against "${NEW_PASSWORD}"!`);
  } else {
    console.warn("\n WARNING: Some users did not match password!");
  }

  await sql.end();
}

run().catch(console.error);

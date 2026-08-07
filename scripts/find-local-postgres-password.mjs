import postgres from "postgres";

const passwordsToTest = [
  "Gulistan@9090",
  "Gulistan9090",
  "postgres",
  "root",
  "admin",
  "123456",
  "password",
  "master",
  "postgres123",
  "1234",
  "0000",
  "12345678",
  "dgt",
  "dgtllc",
  "accounts",
  "superadmin",
  "123"
];

async function findPassword() {
  console.log("=======================================================================");
  console.log("  TESTING LOCAL POSTGRESQL (localhost:5432) PASSWORDS");
  console.log("=======================================================================\n");

  let foundPassword = null;

  for (const pass of passwordsToTest) {
    const encodedPass = encodeURIComponent(pass);
    const url = `postgresql://postgres:${encodedPass}@localhost:5432/postgres`;
    console.log(`▶ Testing password: "${pass}"...`);

    try {
      const sql = postgres(url, { max: 1, prepare: false, connect_timeout: 2 });
      const res = await sql`select version()`;
      if (res && res.length > 0) {
        foundPassword = pass;
        console.log(`  🎉 SUCCESS! MATCHING LOCAL PASSWORD FOUND: "${pass}"\n`);
        await sql.end();
        break;
      }
    } catch (e) {
      console.log(`  ❌ Incorrect password.`);
    }
  }

  console.log("=======================================================================");
  if (foundPassword) {
    console.log(`  ✅ LOCAL POSTGRESQL IS READY!`);
    console.log(`  • Set your DATABASE_URL in .env.local to:`);
    console.log(`    DATABASE_URL=postgresql://postgres:${encodeURIComponent(foundPassword)}@localhost:5432/postgres`);
  } else {
    console.log(`  ⚠️ None of the common passwords matched.`);
    console.log(`  • Please tell me the password you set during PostgreSQL installation.`);
  }
  console.log("=======================================================================");
}

findPassword();

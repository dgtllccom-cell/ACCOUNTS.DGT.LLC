import postgres from 'postgres';

const devUrl = "postgresql://postgres.csesvyxxjivnkkozgopt:Gulistan%409090@aws-1-ap-southeast-2.pooler.supabase.com:6543/postgres";
const sql = postgres(devUrl, { ssl: 'require' });

async function main() {
  try {
    console.log("=== TESTING WITH DEV REAL IDS ===");
    
    // DEV UAE Country ID: 935dd0b9-8228-43b3-b53d-c06e9ae2882f
    // DEV Dubai Branch ID: 87c2e253-b6c1-482d-a808-272337f3ffda
    const testUae = await sql`
      SELECT allocate_4level_serials('account', '935dd0b9-8228-43b3-b53d-c06e9ae2882f', '87c2e253-b6c1-482d-a808-272337f3ffda', 'ACC') as serials
    `;
    console.log("UAE Dubai Branch Account Result:");
    console.log(JSON.stringify(testUae[0].serials, null, 2));

    // DEV Pakistan Country ID: fb021716-a2e7-4141-9c1a-bd1ddd92eb14
    // DEV Quetta City Branch ID: 7d7d42fe-ddd1-4bec-8703-3911ad14fa8b
    const testPak = await sql`
      SELECT allocate_4level_serials('purchase', 'fb021716-a2e7-4141-9c1a-bd1ddd92eb14', '7d7d42fe-ddd1-4bec-8703-3911ad14fa8b', 'PUR') as serials
    `;
    console.log("\nPakistan Quetta Branch Purchase Result:");
    console.log(JSON.stringify(testPak[0].serials, null, 2));

  } catch (err) {
    console.error(err);
  } finally {
    await sql.end();
  }
}

main();

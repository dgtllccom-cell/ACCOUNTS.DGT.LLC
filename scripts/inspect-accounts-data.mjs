import postgres from 'postgres';

const PROD_URL = process.env.PROD_DATABASE_URL || process.env.DATABASE_URL || "";
const DEV_URL = process.env.DEV_DATABASE_URL || "";

async function inspect(label, url) {
  console.log(`\n=================== ${label} ===================`);
  const sql = postgres(url, { ssl: 'require', max: 1 });
  try {
    const custCols = await sql`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'customers' 
      ORDER BY ordinal_position
    `;
    console.log('CUSTOMERS COLUMNS:');
    console.table(custCols.map(c => ({ name: c.column_name, type: c.data_type })));

    const customers = await sql`SELECT * FROM customers LIMIT 5`;
    console.log('SAMPLE CUSTOMERS:');
    console.table(customers.map(c => ({ id: c.id, name: c.customer_name || c.name, code: c.person_code || c.code })));
  } catch (err) {
    console.error(`Error in ${label}:`, err.message);
  } finally {
    await sql.end();
  }
}

async function run() {
  await inspect("PROD DATABASE (inmayhrxucimxqhgseqi)", PROD_URL);
  await inspect("DEV DATABASE (csesvyxxjivnkkozgopt)", DEV_URL);
}

run();

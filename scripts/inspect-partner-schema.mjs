import postgres from 'postgres';

const dbUrl = process.env.DATABASE_URL;
console.log('Connecting to DB:', dbUrl?.replace(/:[^:@]+@/, ':***@'));

const sql = postgres(dbUrl);

async function run() {
  const ea = await sql`
    SELECT * 
    FROM public.enterprise_accounts 
    LIMIT 1
  `;
  console.log('--- Enterprise Accounts Keys ---');
  console.log(Object.keys(ea[0] || {}));

  const ledgers = await sql`
    SELECT * 
    FROM public.ledgers 
    LIMIT 1
  `;
  console.log('--- Ledgers Keys ---');
  console.log(Object.keys(ledgers[0] || {}));

  const billExpenses = await sql`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'bill_expenses' 
    ORDER BY ordinal_position
  `;
  console.log('--- bill_expenses columns ---');
  console.table(billExpenses.map(c => ({ name: c.column_name, type: c.data_type })));

  const roznamchaCols = await sql`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'roznamcha_entries' 
    ORDER BY ordinal_position
  `;
  console.log('--- roznamcha_entries columns ---');
  console.table(roznamchaCols.map(c => ({ name: c.column_name, type: c.data_type })));

  await sql.end();
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});

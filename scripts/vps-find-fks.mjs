import postgres from 'postgres';

const dbUrl = process.env.DATABASE_URL;
const sql = postgres(dbUrl, { ssl: { rejectUnauthorized: false } });

async function run() {
  const fks = await sql`
    SELECT
      tc.table_schema, 
      tc.constraint_name, 
      tc.table_name, 
      kcu.column_name, 
      ccu.table_name AS foreign_table_name,
      ccu.column_name AS foreign_column_name 
    FROM 
      information_schema.table_constraints AS tc 
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY' AND (ccu.table_name = 'users' OR ccu.table_name = 'profiles')
  `;
  console.log('FKs to users or profiles:');
  for (const fk of fks) {
    console.log(`${fk.table_name}.${fk.column_name} -> ${fk.foreign_table_name}.${fk.foreign_column_name}`);
  }
  await sql.end();
}
run();

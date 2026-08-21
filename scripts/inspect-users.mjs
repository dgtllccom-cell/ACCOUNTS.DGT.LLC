import postgres from 'postgres';

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) throw new Error("DATABASE_URL is required");

const sql = postgres(dbUrl, { max: 1, prepare: false });

async function main() {
  const pCols = await sql`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'profiles'
    ORDER BY ordinal_position;
  `;
  console.log("profiles cols:", pCols.map(c => `${c.column_name} (${c.data_type})`).join(', '));

  const users = await sql`
    SELECT * FROM profiles LIMIT 5;
  `;
  console.log("profiles rows:", users);

  await sql.end();
}

main().catch(console.error);

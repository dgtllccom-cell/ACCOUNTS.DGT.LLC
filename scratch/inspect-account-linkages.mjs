import postgres from 'postgres';

const devUrl = "postgresql://postgres.csesvyxxjivnkkozgopt:Gulistan%409090@aws-1-ap-southeast-2.pooler.supabase.com:5432/postgres";
const sql = postgres(devUrl, { ssl: 'require' });

async function main() {
  try {
    const acCols = await sql`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'account_companies';
    `;
    console.log("account_companies columns:\n", acCols);

    const abCols = await sql`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'account_banks';
    `;
    console.log("account_banks columns:\n", abCols);

    const bRes = await sql`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'banks';
    `;
    console.log("banks columns:\n", bRes);
  } finally {
    await sql.end();
  }
}

main();

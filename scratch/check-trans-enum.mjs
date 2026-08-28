import postgres from 'postgres';

const prodUrl = "postgresql://postgres.inmayhrxucimxqhgseqi:9z2_v5b6oZKPrbwoEL-z6awkg53gPDmPf3_pNFbSFsSVQdDk@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres";
const sql = postgres(prodUrl, { ssl: 'require' });

async function main() {
  try {
    const enums = await sql`
      SELECT e.enumlabel 
      FROM pg_type t 
      JOIN pg_enum e ON t.oid = e.enumtypid  
      WHERE t.typname = 'translation_source';
    `;
    console.log("translation_source enum values:", enums.map(e => e.enumlabel));

    const engCols = await sql`
      SELECT column_name, data_type, udt_name 
      FROM information_schema.columns 
      WHERE table_name = 'translations_english';
    `;
    console.log("translations_english cols:", engCols);

    const pashtoCols = await sql`
      SELECT column_name, data_type, udt_name 
      FROM information_schema.columns 
      WHERE table_name = 'translations_pashto';
    `;
    console.log("translations_pashto cols:", pashtoCols);
  } catch (err) {
    console.error(err);
  } finally {
    await sql.end();
  }
}

main();

import postgres from 'postgres';

const prodUrl = "postgresql://postgres.inmayhrxucimxqhgseqi:9z2_v5b6oZKPrbwoEL-z6awkg53gPDmPf3_pNFbSFsSVQdDk@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres";
const sql = postgres(prodUrl, { ssl: 'require' });

async function main() {
  try {
    const custs = await sql`
      SELECT id, customer_name, contact_person, mobile, email, original_language_code, deleted_at, is_active, notes, first_name, last_name, gender
      FROM public.customers
      ORDER BY created_at ASC;
    `;
    for (const c of custs) {
      console.log("-----------------------------------------");
      console.log(`ID: ${c.id}`);
      console.log(`Name: ${c.customer_name}`);
      console.log(`Contact Person: ${c.contact_person}`);
      console.log(`Mobile: ${c.mobile}`);
      console.log(`Email: ${c.email}`);
      console.log(`Language: ${c.original_language_code}`);
      console.log(`Deleted: ${c.deleted_at}`);
      console.log(`Active: ${c.is_active}`);
      console.log(`Notes: ${c.notes}`);
    }
  } catch (err) {
    console.error(err);
  } finally {
    await sql.end();
  }
}

main();

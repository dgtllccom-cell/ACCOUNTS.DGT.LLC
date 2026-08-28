import postgres from 'postgres';

const prodUrl = "postgresql://postgres.inmayhrxucimxqhgseqi:9z2_v5b6oZKPrbwoEL-z6awkg53gPDmPf3_pNFbSFsSVQdDk@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres";
const sql = postgres(prodUrl, { ssl: 'require' });

const CUSTOMER_COLUMNS = [
  "id", "country_id", "state_province_id", "district_id", "city_id", "area_location_id",
  "customer_name", "first_name", "last_name", "father_name", "gender", "photo_url", "person_code",
  "company_name", "contact_person", "mobile", "whatsapp", "email", "address",
  "notes", "original_language_code", "is_active", "created_at", "updated_at"
];

async function main() {
  try {
    const cols = await sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'customers';
    `;
    const colSet = new Set(cols.map(c => c.column_name));
    const missing = CUSTOMER_COLUMNS.filter(c => !colSet.has(c));
    console.log("Missing columns in prod customers table:", missing);
  } catch (err) {
    console.error(err);
  } finally {
    await sql.end();
  }
}

main();

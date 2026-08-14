import postgres from "postgres";

const vpsEnv = {
  DATABASE_URL: "postgresql://postgres.inmayhrxucimxqhgseqi:9z2_v5b6oZKPrbwoEL-z6awkg53gPDmPf3_pNFbSFsSVQdDk@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres"
};
const vpsSql = postgres(vpsEnv.DATABASE_URL, { max: 1, prepare: false, ssl: { rejectUnauthorized: false } });

async function testTransUpsert() {
  const row = {
    id: "00000000-0000-0000-0000-000000000001",
    record_table: "test",
    record_id: "00000000-0000-0000-0000-000000000001",
    field_name: "test_field",
    original_text: "test",
    original_language_code: "en",
    english_text: "Test",
    urdu_text: null,
    arabic_text: null,
    persian_text: null,
    pashto_text: null
  };

  try {
    await vpsSql`
      INSERT INTO public.record_translations (
        id, record_table, record_id, field_name, original_text, original_language_code, english_text, created_at, updated_at
      ) VALUES (
        ${row.id}, ${row.record_table}, ${row.record_id}, ${row.field_name}, ${row.original_text}, ${row.original_language_code}, ${row.english_text}, NOW(), NOW()
      )
      ON CONFLICT (id) DO UPDATE SET english_text = EXCLUDED.english_text;
    `;
    console.log("Upsert succeeded!");
  } catch (e) {
    console.error("Upsert failed:", e.message);
  }
  await vpsSql.end();
  process.exit(0);
}

testTransUpsert();

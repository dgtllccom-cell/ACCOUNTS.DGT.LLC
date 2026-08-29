import { resolveDbUrl } from "../scripts/lib/prod-db-url.mjs";
import postgres from 'postgres';

const prodUrl = resolveDbUrl("prod");
const sql = postgres(prodUrl, { ssl: 'require' });

async function main() {
  try {
    const translations = await sql`
      SELECT * FROM public.record_translations
      WHERE table_name IN ('customers', 'employees')
      LIMIT 50;
    `;
    console.log(`Found ${translations.length} translations:`);
    console.table(translations.map(t => ({
      table: t.table_name,
      record_id: t.record_id,
      field: t.field_name,
      lang: t.language_code,
      val: t.translated_value
    })));
  } catch (err) {
    console.error(err);
  } finally {
    await sql.end();
  }
}

main();

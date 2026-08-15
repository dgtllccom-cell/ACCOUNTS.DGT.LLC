import { withLocalPg } from "../lib/db/local-postgres.ts";
import { getPhraseTranslator, localizeRecordNames } from "../lib/i18n/localize-records.ts";

async function run() {
  console.log("Testing withLocalPg...");
  try {
    const res = await withLocalPg(async (sql) => {
      const rows = await sql`select count(*) from enterprise_accounts where deleted_at is null`;
      return rows;
    });
    console.log("PG Query Result:", res);
  } catch (err) {
    console.error("PG Error:", err);
  }

  console.log("Testing getPhraseTranslator...");
  try {
    const tp = await getPhraseTranslator("ur");
    console.log("Phrase Translator Result for 'Quetta':", tp("Quetta"));
  } catch (err) {
    console.error("Phrase Translator Error:", err);
  }
}

run();

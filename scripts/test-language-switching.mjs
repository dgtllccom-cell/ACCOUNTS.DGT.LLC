import { t } from '../lib/i18n/ui.ts';
import { supportedLanguages } from '../lib/i18n/languages.ts';

console.log("=== TESTING 5-LANGUAGE RESOLUTION AND SWITCHING ===");

const testKeys = [
  "crm.title",
  "crm.cheques_deposit_today",
  "crm.purchase_payments_due",
  "crm.tab_todays_action_list",
  "audit.edit_history_title",
  "audit.deleted_records_title"
];

for (const lang of ["en", "ur", "ar", "fa", "ps"]) {
  console.log(`\n--- Testing Language: ${lang.toUpperCase()} ---`);
  for (const key of testKeys) {
    const val = t(lang, key);
    console.log(`  [${key}] => ${val}`);
  }
}

console.log("\n✅ All 5 languages resolve cleanly without exceptions or hanging!");

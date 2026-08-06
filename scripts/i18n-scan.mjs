#!/usr/bin/env node
/**
 * Multilingual coverage validator.
 *
 * Scans the live database schema for user-facing text columns, classifies each as
 * translate / transliterate / skip (same rules as the field registry), and reports any
 * ELIGIBLE column that is NOT yet registered in `translation_field_registry`.
 *
 * This is the automatic guard so that no new table/field silently ships without
 * multilingual support.
 *
 *   node scripts/i18n-scan.mjs          # report only; exit 1 if unregistered fields exist (CI gate)
 *   node scripts/i18n-scan.mjs --fix    # additionally register the missing fields + (re)attach triggers
 *
 * Requires DATABASE_URL (Supabase Postgres connection string) in the environment.
 */
import postgres from "postgres";

const FIX = process.argv.includes("--fix");
const url = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;
if (!url) {
  console.error("✗ DATABASE_URL is not set. Export your Supabase Postgres connection string.");
  process.exit(2);
}

// Classification — must stay in sync with lib/i18n/translatable-fields.ts and the DB seed.
const SKIP_TECH = /(^|_)(id|uuid)$|_id$|code$|_code|hash|token|secret|password|salt|slug|url|uri|link|email|phone|mobile|whatsapp|fax|(^|_)no$|number$|_number|serial|iban|swift|currency|iso|lat$|lng$|latitude|longitude|colou?r|hex|ip_address|(^|_)ip$|mime|extension|path$|file_?name|(^|_)key$|status|state$|_at$|_date|date$|time$|timestamp|version|_by$|created|updated|deleted|checksum|signature|otp|(^|_)pin$|zip|postal|reference|ref_no|voucher|invoice_no|order_no|account_no|user_code|manual_reference|lang|locale|timezone|rate$|_rate|amount|balance|qty|quantity|percent|width|height|weight|(^|_)size$|barcode|sku|hs_code|gps|domain|host|(^|_)port$|smtp|imap|(^|_)api|webhook/i;
const SKIP_FREEFORM = /narration|remark|(^|_)notes?$|comment|memo|(^|_)details?$/i;
const TRANSLATE = /description|(^|_)desc$|_desc|label|(^|_)title$|_title|display_name|caption|heading|subtitle|(^|_)body$|_body|(^|_)message$|_message|category|unit_name|brand|product_name|goods_name|item_name|type_name|document_type|contract_type|designation|department|template_name/i;
const TRANSLITERATE = /(^|_)name$|_name$|full_name|first_name|last_name|father_name|owner|contact_person|person_name|beneficiary|holder|company_name|business_name|bank_name|branch_name|city|area|province|country_name|alias|(^|_)nick/i;

function classify(col) {
  if (SKIP_TECH.test(col)) return "skip";
  if (SKIP_FREEFORM.test(col)) return "skip";
  if (TRANSLATE.test(col)) return "translate";
  if (TRANSLITERATE.test(col)) return "transliterate";
  return "skip";
}

/**
 * Curated exclusions: columns the coarse heuristic marks eligible but which are
 * intentionally NOT translated. Reasons: financial narration (never machine-translate),
 * message bodies / derived snapshots, the legacy per-language columns (they ARE the
 * translation storage), and technical fields the regex can't tell apart.
 * Reviewed against the live schema; extend this set (with a reason) if new ones appear.
 */
const EXCLUSIONS = new Set([
  // (transaction narration/description/notes/remarks are now REGISTERED, not excluded)
  // message bodies / derived conversation snapshots
  "communication_center_messages.body", "communication_messages.body", "erp_email_messages.body",
  "whatsapp_messages.body", "communication_conversations.last_message_text",
  "whatsapp_conversations.last_message_text", "communication_messages.message_category",
  // sender/actor names on message/log tables (low-value, high-churn)
  "communication_center_messages.sender_name", "communication_conversations.sender_name",
  "erp_email_messages.sender_name", "whatsapp_activity_log.actor_name",
  "communication_contact_preferences.contact_name", "whatsapp_messages.location_name",
  // legacy per-language columns (superseded by record_translations)
  "country_company_profiles.company_name_ar", "country_company_profiles.company_name_en",
  "country_company_profiles.company_name_fa", "country_company_profiles.company_name_ps",
  "country_company_profiles.company_name_ur",
  // denormalized snapshots / mapping copies (source table is translated instead)
  "ledger_posting_batches.branch_name_snapshot", "ledger_posting_lines.branch_name_snapshot",
  "product_warehouse_mapping.warehouse_name",
  // technical / system / reference — not user-authored business text
  "approval_request_items.field_name", "attachments.owner_table", "trucks.capacity",
  "erp_schema_migrations.name", "report_runs.error_message", "erp_pdf_email_jobs.error_message",
  "languages.english_name", "languages.native_name",
]);

const sql = postgres(url, { prepare: false, ssl: "require", idle_timeout: 5, max: 1 });

try {
  const cols = await sql`
    select c.table_name, c.column_name
    from information_schema.columns c
    join information_schema.tables t
      on t.table_schema = c.table_schema and t.table_name = c.table_name
    where c.table_schema = 'public'
      and t.table_type = 'BASE TABLE'
      and c.data_type in ('text','character varying','character','citext')
      and c.table_name not like '%translation%'
      and c.table_name not in ('translation_keys','translation_values','translation_field_registry')
    order by c.table_name, c.column_name`;

  const registered = await sql`select table_name, field_name from translation_field_registry where is_active`;
  const regSet = new Set(registered.map((r) => `${r.table_name}|${r.field_name}`));

  const missing = [];
  for (const { table_name, column_name } of cols) {
    const mode = classify(column_name);
    if (mode === "skip") continue;
    if (EXCLUSIONS.has(`${table_name}.${column_name}`)) continue; // intentionally not translated
    if (!regSet.has(`${table_name}|${column_name}`)) missing.push({ table: table_name, field: column_name, mode });
  }

  if (missing.length === 0) {
    console.log("✓ Multilingual coverage complete — every eligible user-facing field is registered.");
    await sql.end();
    process.exit(0);
  }

  console.log(`✗ ${missing.length} eligible field(s) are NOT registered for multilingual support:\n`);
  for (const m of missing) console.log(`   ${m.table}.${m.field}  →  ${m.mode}`);

  if (FIX) {
    console.log("\n--fix: registering the fields and (re)attaching triggers…");
    for (const m of missing) {
      await sql`insert into translation_field_registry (table_name, field_name, mode)
                values (${m.table}, ${m.field}, ${m.mode})
                on conflict (table_name, field_name) do nothing`;
    }
    const [{ attach_translation_triggers: n }] = await sql`select public.attach_translation_triggers()`;
    console.log(`✓ Registered ${missing.length} field(s); triggers attached to ${n} table(s).`);
    console.log("  NOTE: also add these to lib/i18n/translatable-fields.ts to keep the app registry in sync,");
    console.log("        then run backfill_translation_keyset() for any existing rows.");
    await sql.end();
    process.exit(0);
  }

  console.log("\nRun with --fix to register them automatically, or add them to");
  console.log("lib/i18n/translatable-fields.ts + supabase migration and re-run.");
  await sql.end();
  process.exit(1);
} catch (err) {
  console.error("✗ Scan failed:", err?.message || err);
  try { await sql.end(); } catch {}
  process.exit(2);
}

/**
 * Translation Trigger Service
 *
 * Centralized service that auto-translates master data fields when records
 * are created or updated. Supports all 5 languages (en, ar, ur, fa, ps).
 *
 * Usage:
 *   await translateMasterRecord("countries", record.id, { name: record.name }, "en");
 *
 * This is a non-blocking, fire-and-forget operation — translation failures
 * are logged but never block the main record save.
 */

import { saveEnterpriseRecordTranslations } from "@/lib/services/enterprise-multilingual-service";
import type { SupportedLanguage } from "@/lib/i18n/languages";

/**
 * Defines which fields should be auto-translated for each master table.
 * Only text fields that users see in the UI should be listed here.
 */
const TRANSLATABLE_FIELDS: Record<string, string[]> = {
  // Location hierarchy
  countries: ["name"],
  country_branches: ["name"],
  city_branches: ["name", "city_name"],

  // Accounts & Ledgers
  enterprise_accounts: ["name"],
  accounts: ["name"],
  ledgers: ["name"],

  // Products & Goods
  goods: ["goods_name"],
  goods_variations: ["size", "brand"],

  // Contacts
  customers: ["name", "company_name"],
  suppliers: ["name", "company_name"],
  contact_persons: ["full_name"],

  // Payment & Tax
  payment_methods: ["name"],
  tax_codes: ["name", "description"],

  // Company
  companies: ["name", "legal_name"],
};

/**
 * Translates a master data record's translatable fields into all 5 languages.
 * This is a fire-and-forget operation — translation failures are logged
 * but never block the caller.
 *
 * @param tableName - The database table name (e.g., "countries")
 * @param recordId - The UUID of the record
 * @param fieldValues - An object mapping field names to their current text values
 * @param originalLanguage - The language the text was entered in (default: "en")
 * @param actorId - Optional user ID for audit trail
 */
export async function translateMasterRecord(
  tableName: string,
  recordId: string,
  fieldValues: Record<string, string | null | undefined>,
  originalLanguage: SupportedLanguage = "en",
  actorId?: string | null
): Promise<void> {
  try {
    // Look up which fields are translatable for this table
    const translatableFields = TRANSLATABLE_FIELDS[tableName];
    if (!translatableFields || translatableFields.length === 0) {
      return; // No translatable fields defined for this table
    }

    // Filter to only fields that have a non-empty value and are translatable
    const fields = translatableFields
      .filter((fieldName) => {
        const value = fieldValues[fieldName];
        return typeof value === "string" && value.trim().length > 0;
      })
      .map((fieldName) => ({
        fieldName,
        value: fieldValues[fieldName]!,
      }));

    if (fields.length === 0) {
      return; // No fields to translate
    }

    await saveEnterpriseRecordTranslations({
      recordTable: tableName,
      recordId,
      originalLanguage,
      fields,
      actorId,
      source: "auto",
    });
  } catch (err) {
    // Non-fatal: translation failures should never block the main operation
    console.error(
      `[TranslationTrigger] Failed to translate ${tableName}/${recordId}:`,
      err instanceof Error ? err.message : err
    );
  }
}

/**
 * Batch-translate multiple records of the same table type.
 * Useful when importing or migrating data.
 */
export async function translateMasterRecordsBatch(
  tableName: string,
  records: Array<{ id: string; fields: Record<string, string | null | undefined> }>,
  originalLanguage: SupportedLanguage = "en",
  actorId?: string | null
): Promise<{ translated: number; failed: number }> {
  let translated = 0;
  let failed = 0;

  for (const record of records) {
    try {
      await translateMasterRecord(
        tableName,
        record.id,
        record.fields,
        originalLanguage,
        actorId
      );
      translated++;
    } catch {
      failed++;
    }
  }

  return { translated, failed };
}

/**
 * Returns the list of translatable field names for a given table.
 * Useful for UIs that need to know which fields support translation.
 */
export function getTranslatableFields(tableName: string): string[] {
  return TRANSLATABLE_FIELDS[tableName] ?? [];
}

/**
 * Returns all table names that have translatable fields defined.
 */
export function getTranslatableTables(): string[] {
  return Object.keys(TRANSLATABLE_FIELDS);
}

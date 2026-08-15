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

import { saveVerifiedEnterpriseRecordTranslations } from "@/lib/services/enterprise-multilingual-service";
import type { SupportedLanguage } from "@/lib/i18n/languages";
import { TRANSLATABLE_FIELDS as FIELD_REGISTRY } from "@/lib/i18n/translatable-fields";

/**
 * Single source of truth for translatable fields: the curated Phase 1 registry
 * (`lib/i18n/translatable-fields.ts`). Derived here as table -> field-name[] so the
 * existing trigger keeps working, but there is now ONE field list for the whole ERP
 * (no duplicate map). The registry excludes technical fields, transaction narration,
 * and reporting views by design.
 */
const TRANSLATABLE_FIELDS: Record<string, string[]> = Object.fromEntries(
  Object.entries(FIELD_REGISTRY).map(([table, defs]) => [table, defs.map((d) => d.field)])
);

/** field -> mode lookup per table, so the engine can pick dictionary-only vs
 *  dictionary-then-transliterate behavior per lib/services/auto-translation-service.ts. */
const FIELD_MODES: Record<string, Record<string, "translate" | "transliterate">> = Object.fromEntries(
  Object.entries(FIELD_REGISTRY).map(([table, defs]) => [table, Object.fromEntries(defs.map((d) => [d.field, d.mode]))])
);

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
        mode: FIELD_MODES[tableName]?.[fieldName] ?? "translate",
      }));

    if (fields.length === 0) {
      return; // No fields to translate
    }

    // Honest writer: stores only genuine dictionary/manual translations and flags
    // proper-name gaps needs_review — never machine-guesses a spelling.
    await saveVerifiedEnterpriseRecordTranslations({
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

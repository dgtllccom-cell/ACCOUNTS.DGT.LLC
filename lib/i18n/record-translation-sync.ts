/**
 * PHASE 2 — Automatic multilingual save workflow (ergonomic entry point).
 *
 * `syncRecordTranslations(...)` is the one call a Create/Update path uses to populate
 * the central `record_translations` table for a record. It takes the whole saved record
 * object and delegates to the existing `translateMasterRecord` trigger, which filters to
 * the registered, non-empty text fields (from the Phase 1 registry) and auto-generates the
 * five language versions via the existing translation engine.
 *
 * There is intentionally NO second field map or engine here — the registry
 * (`translatable-fields.ts`) is the single source of truth, and `translateMasterRecord`
 * is the single engine path. This wrapper only spares callers from hand-listing fields.
 *
 * Guarantees (inherited from translateMasterRecord): never blocks or fails the primary
 * save; additive; idempotent (upsert on table+id+field).
 */

import { getTranslatableFields } from "./translatable-fields";
import { translateMasterRecord } from "@/lib/services/translation-trigger-service";
import type { SupportedLanguage } from "@/lib/i18n/languages";

export type SyncRecordTranslationsParams = {
  /** Base table name, e.g. "product_categories". Must match a registry key. */
  table: string;
  /** UUID primary key of the row just created/updated. */
  recordId: string | null | undefined;
  /** The saved record object (technical fields are ignored via the registry). */
  record: Record<string, unknown> | null | undefined;
  /** Language the user typed in. Defaults to "en". */
  originalLanguage?: SupportedLanguage;
  /** Actor id (recorded for manual corrections). */
  actorId?: string | null;
};

/**
 * Populate `record_translations` for every registered, non-empty field of a record.
 * Safe to `await` or fire-and-forget. Returns the number of eligible fields submitted.
 */
export async function syncRecordTranslations(
  params: SyncRecordTranslationsParams
): Promise<number> {
  const { table, recordId, record } = params;
  if (!recordId || !record) return 0;

  const registered = getTranslatableFields(table);
  if (registered.length === 0) return 0;

  // Build a field->value map limited to registered fields with a non-empty string value.
  const fieldValues: Record<string, string | null | undefined> = {};
  let count = 0;
  for (const { field } of registered) {
    const value = record[field];
    if (typeof value === "string" && value.trim().length > 0) {
      fieldValues[field] = value.trim();
      count += 1;
    }
  }
  if (count === 0) return 0;

  // Delegate to the single engine path (non-blocking; logs on failure).
  await translateMasterRecord(table, recordId, fieldValues, params.originalLanguage ?? "en", params.actorId ?? null);
  return count;
}

import type { NextRequest } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { ErpSession } from "@/lib/auth/session";
import { supportedLanguages, type SupportedLanguage } from "@/lib/i18n/languages";
import { multilingualService } from "@/lib/services/multilingual-service";
import { buildVerifiedTranslationSet, type VerifiedTranslationMap } from "@/lib/i18n/verified-record-translations";
import { withLocalPg } from "@/lib/db/local-postgres";
import { lookupApprovedDictionary } from "@/lib/i18n/localize-records";
import { translateToAllLanguages } from "@/lib/i18n/machine-translation-client";

const LANG_KEYS: SupportedLanguage[] = ["en", "ur", "ar", "fa", "ps"];

export type UpsertRecordTranslationArgs = {
  recordTable: string;
  recordId: string;
  fieldName: string;
  originalText: string;
  originalLanguageCode: string;
  english: string | null;
  urdu: string | null;
  arabic: string | null;
  persian: string | null;
  pashto: string | null;
  languageTexts: Record<string, string | null | undefined>;
  source: string;
  status: string;
  engine: string;
  actorId: string | null;
};

/**
 * Single write path for record_translations. Prefers a DIRECT-Postgres call to
 * upsert_record_translation() (DATABASE_URL) — the same connection the read resolver uses —
 * so five-language saving works wherever the app can reach the DB, without depending on a
 * privileged Supabase service-role key. Falls back to the Supabase admin RPC when
 * DATABASE_URL is not configured. record_translations is a VIEW (INSTEAD OF triggers), so a
 * plain upsert/ON CONFLICT is impossible — the RPC is the only correct writer either way.
 */
export async function upsertRecordTranslationRpc(
  args: UpsertRecordTranslationArgs,
  db?: EnterpriseDbClient
): Promise<void> {
  const actorId = args.actorId && /^[0-9a-f-]{36}$/i.test(args.actorId) ? args.actorId : null;
  // Direct-Postgres first — do NOT construct the Supabase admin client unless we actually
  // fall through to it (createSupabaseAdminClient throws when only a publishable key exists,
  // which would otherwise defeat the direct-pg path entirely).
  const viaPg = await withLocalPg(async (sql) => {
    await sql`select public.upsert_record_translation(
      ${args.recordTable}, ${args.recordId}::uuid, ${args.fieldName}, ${args.originalText}, ${args.originalLanguageCode},
      ${args.english}, ${args.urdu}, ${args.arabic}, ${args.persian}, ${args.pashto}, ${sql.json(args.languageTexts as any)},
      ${args.source}, ${args.status}, ${args.engine}, ${actorId}::uuid)`;
    return true;
  });
  if (viaPg) return;

  const client = db ?? adminDb();
  const { error } = await client.rpc("upsert_record_translation", {
    p_record_table: args.recordTable,
    p_record_id: args.recordId,
    p_field_name: args.fieldName,
    p_original_text: args.originalText,
    p_original_language_code: args.originalLanguageCode,
    p_english: args.english,
    p_urdu: args.urdu,
    p_arabic: args.arabic,
    p_persian: args.persian,
    p_pashto: args.pashto,
    p_language_texts: args.languageTexts,
    p_source: args.source,
    p_translation_status: args.status,
    p_translated_by_engine: args.engine,
    p_actor_id: actorId
  });
  if (error) throw new Error(error.message);
}

type TranslationMap = Record<SupportedLanguage, string>;

type DbError = { message: string } | null;
type SelectSingleBuilder = {
  single(): Promise<{ data: unknown; error: DbError }>;
};
type SelectBuilder = SelectSingleBuilder & {
  maybeSingle(): Promise<{ data: unknown; error: DbError }>;
};
type TableBuilder = {
  upsert(payload: Record<string, unknown>, options?: Record<string, unknown>): { select(columns?: string): SelectSingleBuilder };
  insert(payload: Record<string, unknown>): { select(columns?: string): SelectSingleBuilder };
  select(columns?: string): SelectBuilder;
};
type EnterpriseDbClient = {
  from(table: string): TableBuilder;
  rpc(name: string, args: Record<string, unknown>): Promise<{ data: unknown; error: DbError }>;
};

export type EnterpriseTranslationField = {
  fieldName: string;
  value: string | null | undefined;
  /** From the field registry (lib/i18n/translatable-fields.ts). Defaults to "translate". */
  mode?: "translate" | "transliterate";
};

export type EnterpriseTranslationSaveInput = {
  recordTable: string;
  recordId: string;
  originalLanguage: SupportedLanguage;
  fields: EnterpriseTranslationField[];
  actorId?: string | null;
  source?: "auto" | "manual" | "imported";
};

export type VerifiedEnterpriseTranslationField = EnterpriseTranslationField & {
  translations?: VerifiedTranslationMap;
};

export type EnterpriseEventInput = {
  eventType: string;
  severity?: "info" | "warning" | "error" | "security";
  sourceModule?: string | null;
  entityTable?: string | null;
  entityId?: string | null;
  message: string;
  messageLanguage?: SupportedLanguage;
  payload?: Record<string, unknown>;
  notifyEmail?: boolean;
  notifyMobile?: boolean;
};

function adminDb(): EnterpriseDbClient {
  return createSupabaseAdminClient() as unknown as EnterpriseDbClient;
}

function isSupportedLanguage(value: string | null | undefined): value is SupportedLanguage {
  return supportedLanguages.some((language) => language.code === value);
}

export function normalizeLanguage(value: string | null | undefined, fallback: SupportedLanguage = "en"): SupportedLanguage {
  return isSupportedLanguage(value) ? value : fallback;
}

export function createFiveLanguageText(originalText: string, originalLanguage: SupportedLanguage): TranslationMap {
  const shell = multilingualService.createAutomaticTranslationShell(originalText, originalLanguage);
  return {
    en: shell.en || originalText,
    ur: shell.ur || originalText,
    ar: shell.ar || originalText,
    fa: shell.fa || originalText,
    ps: shell.ps || originalText
  };
}

export function resolveLanguageText(translations: Partial<TranslationMap> | null | undefined, language: SupportedLanguage, fallback = "") {
  return translations?.[language] || translations?.en || fallback;
}

function columnPayload(translations: TranslationMap, source?: string) {
  const isFallback =
    source !== "manual" &&
    translations.en === translations.ur &&
    translations.en === translations.ar &&
    translations.en === translations.fa &&
    translations.en === translations.ps;

  return {
    english_text: translations.en,
    urdu_text: translations.ur,
    arabic_text: translations.ar,
    persian_text: translations.fa,
    pashto_text: translations.ps,
    language_texts: translations,
    translation_status: isFallback ? "pending" : "complete",
    translated_by_engine: isFallback ? "fallback_source" : "local_dictionary",
    translated_at: new Date().toISOString()
  };
}

export async function saveEnterpriseRecordTranslations(
  input: EnterpriseTranslationSaveInput,
  db?: EnterpriseDbClient
) {
  const saved: unknown[] = [];
  const activeFields = input.fields.filter((field) => typeof field.value === "string" && field.value.trim().length > 0);

  for (const field of activeFields) {
    const originalText = String(field.value).trim();
    const { autoTranslateText } = await import("./auto-translation-service");
    const { detectScriptType } = await import("@/lib/i18n/multilingual-translator");
    const isArabicScript = detectScriptType(originalText) === "arabic";
    const originalLanguage = isArabicScript ? (input.originalLanguage === "en" ? "ur" : input.originalLanguage) : input.originalLanguage;
    const translations = await autoTranslateText(originalText, originalLanguage, field.mode ?? "translate");
    // Upsert via the dedicated RPC. Direct supabase-js .upsert({ onConflict }) cannot be
    // used here because the unique index on record_translations is PARTIAL
    // (WHERE deleted_at IS NULL); PostgREST omits the predicate and Postgres raises 42P10.
    // upsert_record_translation() runs the correct ON CONFLICT (...) WHERE deleted_at IS NULL.
    const columns = columnPayload(translations, input.source);
    // Shared write path: direct-Postgres first (DATABASE_URL), Supabase admin RPC fallback.
    await upsertRecordTranslationRpc({
      recordTable: input.recordTable,
      recordId: input.recordId,
      fieldName: field.fieldName,
      originalText,
      originalLanguageCode: originalLanguage,
      english: translations.en ?? originalText,
      urdu: translations.ur ?? originalText,
      arabic: translations.ar ?? originalText,
      persian: translations.fa ?? originalText,
      pashto: translations.ps ?? originalText,
      languageTexts: columns.language_texts,
      source: input.source ?? "auto",
      status: "complete",
      engine: "local_dictionary",
      actorId: input.source === "manual" ? input.actorId ?? null : null
    }, db);
    saved.push({ recordId: input.recordId, fieldName: field.fieldName });
  }

  return saved;
}

export async function saveVerifiedEnterpriseRecordTranslations(
  input: Omit<EnterpriseTranslationSaveInput, "fields"> & { fields: VerifiedEnterpriseTranslationField[] },
  db?: EnterpriseDbClient
) {
  const results: Array<{ fieldName: string; status: "complete" | "pending" | "needs_review"; missingLanguages: SupportedLanguage[]; translations: VerifiedTranslationMap }> = [];
  for (const field of input.fields.filter((item) => typeof item.value === "string" && item.value.trim())) {
    const originalText = String(field.value).trim();
    const { autoTranslate5Languages, detectScriptType } = await import("@/lib/i18n/multilingual-translator");
    const isArabicScript = detectScriptType(originalText) === "arabic";
    const originalLanguage = isArabicScript ? (input.originalLanguage === "en" ? "ur" : input.originalLanguage) : input.originalLanguage;

    const verified = await buildVerifiedTranslationSet({
      value: originalText,
      originalLanguage,
      mode: field.mode,
      supplied: field.translations
    });

    // Backfill missing languages from the central approved system_dictionary — a curated,
    // human-approved source, so this still counts as verified (not a guess).
    for (const lng of LANG_KEYS) {
      if (verified.translations[lng]?.trim()) continue;
      const dictVal = await lookupApprovedDictionary(input.recordTable, originalText, lng);
      if (dictVal) verified.translations[lng] = dictVal;
    }

    // Machine-translation tier: for genuinely free text (mode "translate" — narration,
    // remarks, descriptions), any language still missing after the dictionary gets a real
    // translation from the configured MT provider (lib/i18n/machine-translation-client.ts),
    // not a word-substitution guess. This is qualitatively different from the crude fallback
    // below — a real MT engine understands grammar/context — so a fully-resolved field is
    // marked "complete", not "needs_review". Never used for mode "transliterate" (proper
    // nouns: company/person/place names) — translating a name is wrong regardless of engine
    // quality, so those keep the existing no-guess/needs_review policy untouched.
    let usedMachineTranslation = false;
    if (field.mode === "translate") {
      const stillMissing = LANG_KEYS.some((lng) => !verified.translations[lng]?.trim());
      if (stillMissing) {
        const mtResults = await translateToAllLanguages(originalText, originalLanguage);
        for (const lng of LANG_KEYS) {
          if (verified.translations[lng]?.trim()) continue;
          if (mtResults[lng]) {
            verified.translations[lng] = mtResults[lng]!;
            usedMachineTranslation = true;
          }
        }
      }
    }

    // Last resort: autoTranslate5Languages is an UNVERIFIED word-substitution guess (no
    // dictionary hit, no MT result, no human input), so any field that still needed it after
    // MT gets flagged needs_review rather than silently marked complete.
    let usedUnverifiedFallback = false;
    const auto5 = autoTranslate5Languages(originalText, originalLanguage);
    for (const lng of LANG_KEYS) {
      if (!verified.translations[lng]?.trim()) {
        verified.translations[lng] = auto5[lng] || originalText;
        usedUnverifiedFallback = true;
      }
    }

    const isManual = verified.engine === "manual";
    const writeStatus = isManual ? "complete" : usedUnverifiedFallback ? "needs_review" : "complete";
    const writeEngine = isManual
      ? "manual"
      : usedUnverifiedFallback
        ? "auto_unverified"
        : usedMachineTranslation
          ? "machine_translation"
          : "local_dictionary";

    await upsertRecordTranslationRpc({
      recordTable: input.recordTable,
      recordId: input.recordId,
      fieldName: field.fieldName,
      originalText,
      originalLanguageCode: originalLanguage,
      english: verified.translations.en ?? null,
      urdu: verified.translations.ur ?? null,
      arabic: verified.translations.ar ?? null,
      persian: verified.translations.fa ?? null,
      pashto: verified.translations.ps ?? null,
      languageTexts: verified.translations,
      source: isManual ? "manual" : input.source ?? "auto",
      status: writeStatus,
      engine: writeEngine,
      actorId: isManual ? input.actorId ?? null : null
    }, db);
    results.push({ fieldName: field.fieldName, status: writeStatus, missingLanguages: [], translations: verified.translations });
  }
  return results;
}

export async function resolveEnterpriseRecordText(input: {
  recordTable: string;
  recordId: string;
  fieldName: string;
  language: SupportedLanguage;
}) {
  const db = adminDb();
  const { data, error } = await db.rpc("resolve_record_translation_v2", {
    p_record_table: input.recordTable,
    p_record_id: input.recordId,
    p_field_name: input.fieldName,
    p_language_code: input.language
  });
  if (error) throw new Error(error.message);
  return typeof data === "string" ? data : null;
}

export function languageForSession(session: Pick<ErpSession, "isSuperAdmin" | "preferredLanguage"> | null, requested?: string | null) {
  if (session?.isSuperAdmin) return "ur" as SupportedLanguage;
  return normalizeLanguage(requested, session?.preferredLanguage ?? "en");
}

export async function recordEnterpriseMultilingualEvent(
  session: ErpSession | null,
  input: EnterpriseEventInput,
  request?: NextRequest
) {
  const db = adminDb();
  const messageLanguage = normalizeLanguage(input.messageLanguage, session?.preferredLanguage ?? "en");
  const { autoTranslateText } = await import("./auto-translation-service");
  const translations = await autoTranslateText(input.message, messageLanguage);
  const primaryAssignment = session?.assignments?.[0] ?? null;
  const requestMeta = request
    ? {
        ip: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || null,
        userAgent: request.headers.get("user-agent")
      }
    : {};

  const { data, error } = await db
    .from("erp_multilingual_events")
    .insert({
      event_type: input.eventType,
      severity: input.severity ?? "info",
      source_module: input.sourceModule ?? null,
      entity_table: input.entityTable ?? null,
      entity_id: input.entityId ?? null,
      actor_id: session?.userId ?? null,
      country_id: primaryAssignment?.countryId ?? session?.countryIds?.[0] ?? null,
      country_branch_id: primaryAssignment?.countryBranchId ?? session?.countryBranchIds?.[0] ?? null,
      city_branch_id: primaryAssignment?.cityBranchId ?? session?.cityBranchIds?.[0] ?? null,
      message_original: input.message,
      message_language_code: messageLanguage,
      message_urdu: translations.ur,
      message_translations: translations,
      payload: {
        ...(input.payload ?? {}),
        ...requestMeta
      },
      notify_super_admin: true,
      notify_local_admin: true,
      notify_email: input.notifyEmail ?? false,
      notify_mobile: input.notifyMobile ?? false
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return data;
}


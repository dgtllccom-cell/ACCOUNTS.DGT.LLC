import type { NextRequest } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { ErpSession } from "@/lib/auth/session";
import { supportedLanguages, type SupportedLanguage } from "@/lib/i18n/languages";
import { multilingualService } from "@/lib/services/multilingual-service";
import { buildVerifiedTranslationSet, type VerifiedTranslationMap } from "@/lib/i18n/verified-record-translations";

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
  db: EnterpriseDbClient = adminDb()
) {
  const saved: unknown[] = [];
  const activeFields = input.fields.filter((field) => typeof field.value === "string" && field.value.trim().length > 0);

  for (const field of activeFields) {
    const originalText = String(field.value).trim();
    const { autoTranslateText } = await import("./auto-translation-service");
    const translations = await autoTranslateText(originalText, input.originalLanguage, field.mode ?? "translate");
    // Upsert via the dedicated RPC. Direct supabase-js .upsert({ onConflict }) cannot be
    // used here because the unique index on record_translations is PARTIAL
    // (WHERE deleted_at IS NULL); PostgREST omits the predicate and Postgres raises 42P10.
    // upsert_record_translation() runs the correct ON CONFLICT (...) WHERE deleted_at IS NULL.
    const columns = columnPayload(translations, input.source);
    const { data, error } = await db.rpc("upsert_record_translation", {
      p_record_table: input.recordTable,
      p_record_id: input.recordId,
      p_field_name: field.fieldName,
      p_original_text: originalText,
      p_original_language_code: input.originalLanguage,
      p_english: translations.en ?? originalText,
      p_urdu: translations.ur ?? originalText,
      p_arabic: translations.ar ?? originalText,
      p_persian: translations.fa ?? originalText,
      p_pashto: translations.ps ?? originalText,
      p_language_texts: columns.language_texts,
      p_source: input.source ?? "auto",
      p_translation_status: columns.translation_status,
      p_translated_by_engine: columns.translated_by_engine,
      p_actor_id: input.source === "manual" ? input.actorId ?? null : null
    });

    if (error) throw new Error(error.message);
    saved.push(data);
  }

  return saved;
}

export async function saveVerifiedEnterpriseRecordTranslations(
  input: Omit<EnterpriseTranslationSaveInput, "fields"> & { fields: VerifiedEnterpriseTranslationField[] },
  db: EnterpriseDbClient = adminDb()
) {
  const results: Array<{ fieldName: string; status: "complete" | "pending"; missingLanguages: SupportedLanguage[]; translations: VerifiedTranslationMap }> = [];
  for (const field of input.fields.filter((item) => typeof item.value === "string" && item.value.trim())) {
    const originalText = String(field.value).trim();
    const verified = await buildVerifiedTranslationSet({
      value: originalText,
      originalLanguage: input.originalLanguage,
      mode: field.mode,
      supplied: field.translations
    });
    const { error } = await db.rpc("upsert_record_translation", {
      p_record_table: input.recordTable,
      p_record_id: input.recordId,
      p_field_name: field.fieldName,
      p_original_text: originalText,
      p_original_language_code: input.originalLanguage,
      p_english: verified.translations.en ?? null,
      p_urdu: verified.translations.ur ?? null,
      p_arabic: verified.translations.ar ?? null,
      p_persian: verified.translations.fa ?? null,
      p_pashto: verified.translations.ps ?? null,
      p_language_texts: verified.translations,
      p_source: verified.engine === "manual" ? "manual" : input.source ?? "auto",
      p_translation_status: verified.status,
      p_translated_by_engine: verified.engine,
      p_actor_id: verified.engine === "manual" ? input.actorId ?? null : null
    });
    if (error) throw new Error(error.message);
    results.push({ fieldName: field.fieldName, status: verified.status, missingLanguages: verified.missingLanguages, translations: verified.translations });
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


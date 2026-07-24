import { NextRequest } from "next/server";
import { apiCreated, apiOk, handleApiError } from "@/lib/api/response";
import { recordTranslationSchema, supportedLanguageSchema } from "@/lib/api/erp-validation";
import { auditApiAction } from "@/lib/api/audit";
import { createApiSupabaseClient } from "@/lib/api/supabase";
import { requireErpSession } from "@/lib/auth/session";
import type { SupportedLanguage } from "@/lib/i18n/languages";
import { authorize } from "@/lib/permissions/middleware";
import { createFiveLanguageText } from "@/lib/services/enterprise-multilingual-service";
import { multilingualService } from "@/lib/services/multilingual-service";

type TranslationRow = {
  id: string;
  record_table: string;
  record_id: string;
  field_name: string;
  original_text: string;
  original_language_code: string;
  english_text: string | null;
  arabic_text: string | null;
  urdu_text: string | null;
  persian_text: string | null;
  pashto_text: string | null;
  source: string;
};

function buildTranslationColumns(originalText: string, originalLanguage: SupportedLanguage, overrides?: Partial<Record<SupportedLanguage, string>>) {
  const generated = createFiveLanguageText(originalText, originalLanguage);
  return {
    en: overrides?.en || generated.en,
    ar: overrides?.ar || generated.ar,
    ur: overrides?.ur || generated.ur,
    fa: overrides?.fa || generated.fa,
    ps: overrides?.ps || generated.ps
  };
}

export async function GET(request: NextRequest) {
  try {
    await requireErpSession();
    const recordTable = request.nextUrl.searchParams.get("recordTable");
    const recordId = request.nextUrl.searchParams.get("recordId");
    const fieldName = request.nextUrl.searchParams.get("fieldName");
    const requestedLanguage = supportedLanguageSchema.safeParse(request.nextUrl.searchParams.get("language") ?? "en");
    const language = requestedLanguage.success ? requestedLanguage.data : "en";

    const supabase = await createApiSupabaseClient();
    let query = supabase
      .from("record_translations")
      .select(
        "id, record_table, record_id, field_name, original_text, original_language_code, english_text, arabic_text, urdu_text, persian_text, pashto_text, source, created_at, updated_at"
      )
      .is("deleted_at", null)
      .order("updated_at", { ascending: false });

    if (recordTable) query = query.eq("record_table", recordTable);
    if (recordId) query = query.eq("record_id", recordId);
    if (fieldName) query = query.eq("field_name", fieldName);

    const { data, error } = await query.limit(100);

    if (error) {
      throw new Error(error.message);
    }

    const translations = (data ?? []) as TranslationRow[];

    return apiOk({
      translations,
      resolved: translations.map((translation) => {
        return {
          id: translation.id,
          recordTable: translation.record_table,
          recordId: translation.record_id,
          fieldName: translation.field_name,
          text:
            multilingualService.resolveText(
              {
                originalText: translation.original_text,
                originalLanguage: translation.original_language_code as SupportedLanguage,
                en: translation.english_text ?? undefined,
                ar: translation.arabic_text ?? undefined,
                ur: translation.urdu_text ?? undefined,
                fa: translation.persian_text ?? undefined,
                ps: translation.pashto_text ?? undefined
              },
              language
            )
        };
      })
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireErpSession();
    authorize(session, { resource: "settings", action: "update" });

    const body = recordTranslationSchema.parse(await request.json());
    const supabase = await createApiSupabaseClient();
    const translations = buildTranslationColumns(body.originalText, body.originalLanguage, body.translations);
    const payload = multilingualService.createRecordTranslationPayload({
      recordTable: body.recordTable,
      recordId: body.recordId,
      fieldName: body.fieldName,
      text: {
        originalText: body.originalText,
        originalLanguage: body.originalLanguage,
        en: translations.en,
        ar: translations.ar,
        ur: translations.ur,
        fa: translations.fa,
        ps: translations.ps
      }
    });

    const existingResult = await supabase
      .from("record_translations")
      .select("*")
      .eq("record_table", body.recordTable)
      .eq("record_id", body.recordId)
      .eq("field_name", body.fieldName)
      .is("deleted_at", null)
      .maybeSingle();

    if (existingResult.error) {
      throw new Error(existingResult.error.message);
    }

    const dbPayload = {
      record_table: payload.recordTable,
      record_id: payload.recordId,
      field_name: payload.fieldName,
      original_text: payload.originalText,
      original_language_code: payload.originalLanguageCode,
      english_text: payload.englishText,
      arabic_text: payload.arabicText,
      urdu_text: payload.urduText,
      persian_text: payload.persianText,
      pashto_text: payload.pashtoText,
      language_texts: {
        en: translations.en,
        ur: translations.ur,
        ps: translations.ps,
        fa: translations.fa,
        ar: translations.ar
      },
      translation_status: "complete",
      translated_by_engine: "local_dictionary",
      translated_at: new Date().toISOString(),
      source: body.source,
      corrected_by: body.source === "manual" ? session.userId : null,
      corrected_at: body.source === "manual" ? new Date().toISOString() : null,
      updated_at: new Date().toISOString()
    };

    const saveResult = existingResult.data
      ? await supabase
          .from("record_translations")
          .update(dbPayload)
          .eq("id", (existingResult.data as { id: string }).id)
          .select("*")
          .single()
      : await supabase.from("record_translations").insert(dbPayload).select("*").single();

    if (saveResult.error) {
      throw new Error(saveResult.error.message);
    }

    const saved = saveResult.data as { id: string };

    await supabase.from("translation_audit_logs").insert({
      record_translation_id: saved.id,
      actor_id: session.userId,
      before: existingResult.data ?? null,
      after: saveResult.data,
      action: existingResult.data ? "update" : "create"
    });

    await auditApiAction(request, {
      action: existingResult.data ? "translation.update" : "translation.create",
      entityTable: "record_translations",
      entityId: saved.id,
      before: existingResult.data ?? null,
      after: saveResult.data
    });

    return apiCreated({
      translation: saveResult.data
    });
  } catch (error) {
    return handleApiError(error);
  }
}


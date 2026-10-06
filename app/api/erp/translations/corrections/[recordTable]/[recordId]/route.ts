import { NextRequest } from "next/server";
import { z } from "zod";
import { apiOk, handleApiError, ApiClientError } from "@/lib/api/response";
import { uuidSchema, supportedLanguageSchema } from "@/lib/api/erp-validation";
import { requireErpSession } from "@/lib/auth/session";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import { createApiSupabaseClient, requireSupabaseData, writeAuditLog } from "@/lib/api/supabase";
import { getTranslationRecordAdapter } from "@/lib/i18n/translation-record-adapters";
import { saveVerifiedEnterpriseRecordTranslations } from "@/lib/services/enterprise-multilingual-service";
import { validateManualTranslationInput } from "@/lib/i18n/verified-record-translations";

const paramsSchema = z.object({ recordTable: z.string(), recordId: uuidSchema });
const translationsSchema = z.object({
  en: z.string().trim().max(10_000).optional(),
  ur: z.string().trim().max(10_000).optional(),
  ar: z.string().trim().max(10_000).optional(),
  fa: z.string().trim().max(10_000).optional(),
  ps: z.string().trim().max(10_000).optional()
});
const correctionSchema = z.object({
  fields: z.array(z.object({ fieldName: z.string().min(1).max(160), translations: translationsSchema })).min(1)
});

async function authorizeRecord(requestedTable: string, recordId: string, action: "read" | "write") {
  const adapter = getTranslationRecordAdapter(requestedTable);
  if (!adapter) throw new ApiClientError("Unsupported translation record type.");
  const session = await requireErpSession();
  const supabase = (await createApiSupabaseClient()) as any;
  const record = await requireSupabaseData(
    supabase.from(requestedTable).select("id, country_id, country_branch_id, city_branch_id").eq("id", recordId).is("deleted_at", null).maybeSingle()
  );
  authorizeApiScope(session, {
    resource: adapter.resource,
    action: action === "read" ? "read" : adapter.writeAction,
    countryId: (record as any).country_id,
    countryBranchId: (record as any).country_branch_id,
    cityBranchId: (record as any).city_branch_id
  });
  return { session, supabase, adapter };
}

export async function GET(_request: NextRequest, context: { params: Promise<{ recordTable: string; recordId: string }> }) {
  try {
    const params = paramsSchema.parse(await context.params);
    const { supabase, adapter } = await authorizeRecord(params.recordTable, params.recordId, "read");
    const { data, error } = await supabase
      .from("record_translations")
      .select("id, field_name, original_text, original_language_code, english_text, urdu_text, arabic_text, persian_text, pashto_text, translation_status, translated_by_engine, updated_at")
      .eq("record_table", params.recordTable)
      .eq("record_id", params.recordId)
      .is("deleted_at", null)
      .order("field_name");
    if (error) throw new Error(error.message);
    return apiOk({ recordTable: params.recordTable, recordId: params.recordId, adapter, fields: data ?? [] });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ recordTable: string; recordId: string }> }) {
  try {
    const params = paramsSchema.parse(await context.params);
    const body = correctionSchema.parse(await request.json());
    const { session, supabase } = await authorizeRecord(params.recordTable, params.recordId, "write");
    const { data: existingRows, error } = await supabase
      .from("record_translations")
      .select("field_name, original_text, original_language_code")
      .eq("record_table", params.recordTable)
      .eq("record_id", params.recordId)
      .is("deleted_at", null);
    if (error) throw new Error(error.message);
    const existing = new Map((existingRows ?? []).map((row: any) => [row.field_name, row]));
    const unknown = body.fields.filter((field) => !existing.has(field.fieldName)).map((field) => field.fieldName);
    if (unknown.length) throw new ApiClientError(`Fields are not enrolled for this record: ${unknown.join(", ")}`);

    const results = [];
    for (const field of body.fields) {
      const source = existing.get(field.fieldName) as any;
      const originalLanguage = supportedLanguageSchema.parse(source.original_language_code);
      const originalText = String(source.original_text || "").trim();
      const validationError = validateManualTranslationInput({ fieldName: field.fieldName, originalText, originalLanguage, translations: field.translations });
      if (validationError) throw new ApiClientError(validationError);
      const [result] = await saveVerifiedEnterpriseRecordTranslations({
        recordTable: params.recordTable,
        recordId: params.recordId,
        originalLanguage,
        actorId: session.userId,
        source: "manual",
        fields: [{ fieldName: field.fieldName, value: originalText, translations: field.translations }]
      });
      results.push(result);
    }

    await writeAuditLog({
      action: "translation.correct",
      entityTable: params.recordTable,
      entityId: params.recordId,
      before: existingRows ?? [],
      after: results,
      ipAddress: request.headers.get("x-forwarded-for") ?? null
    });
    return apiOk({
      status: results.every((result) => result.status === "complete") ? "complete" : "pending",
      fields: results
    });
  } catch (error) {
    return handleApiError(error);
  }
}

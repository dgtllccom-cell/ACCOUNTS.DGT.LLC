import { NextRequest } from "next/server";
import { apiCreated, apiOk, handleApiError } from "@/lib/api/response";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireErpSession } from "@/lib/auth/session";
import { supportedLanguageSchema } from "@/lib/api/erp-validation";
import type { SupportedLanguage } from "@/lib/i18n/languages";
import {
  languageForSession,
  recordEnterpriseMultilingualEvent,
  resolveLanguageText
} from "@/lib/services/enterprise-multilingual-service";

type DbError = { message: string } | null;
type EventQuery = PromiseLike<{ data: unknown[] | null; error: DbError }> & {
  select(columns?: string): EventQuery;
  is(column: string, value: null): EventQuery;
  order(column: string, options?: { ascending?: boolean }): EventQuery;
  limit(count: number): EventQuery;
  in(column: string, values: string[]): EventQuery;
  eq(column: string, value: string): EventQuery;
};

type MultilingualEventRow = {
  message_translations: Partial<Record<SupportedLanguage, string>> | null;
  message_original: string;
  [key: string]: unknown;
};

function eventQuery(table: string): EventQuery {
  const supabase = createSupabaseAdminClient();
  return supabase.from(table) as unknown as EventQuery;
}

export async function GET(request: NextRequest) {
  try {
    const session = await requireErpSession();
    const languageParam = request.nextUrl.searchParams.get("language");
    const parsedLanguage = supportedLanguageSchema.safeParse(languageParam ?? session.preferredLanguage ?? "en");
    const language = languageForSession(session, parsedLanguage.success ? parsedLanguage.data : null);
    const limit = Math.min(Number(request.nextUrl.searchParams.get("limit") ?? 50), 100);

    if (session.isSuperAdmin) {
      const { data, error } = await eventQuery("super_admin_urdu_notifications")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) throw new Error(error.message);
      return apiOk({ events: data ?? [], language: "ur" });
    }

    let query = eventQuery("erp_multilingual_events")
      .select("*")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (session.cityBranchIds.length > 0) {
      query = query.in("city_branch_id", session.cityBranchIds);
    } else if (session.countryBranchIds.length > 0) {
      query = query.in("country_branch_id", session.countryBranchIds);
    } else if (session.countryIds.length > 0) {
      query = query.in("country_id", session.countryIds);
    } else {
      query = query.eq("id", "00000000-0000-0000-0000-000000000000");
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);

    const events = ((data ?? []) as MultilingualEventRow[]).map((event) => ({
      ...event,
      message: resolveLanguageText(event.message_translations, language, event.message_original)
    }));

    return apiOk({ events, language });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireErpSession();
    const body = (await request.json()) as {
      eventType?: string;
      severity?: "info" | "warning" | "error" | "security";
      sourceModule?: string;
      entityTable?: string;
      entityId?: string;
      message?: string;
      messageLanguage?: string;
      payload?: Record<string, unknown>;
      notifyEmail?: boolean;
      notifyMobile?: boolean;
    };

    if (!body.eventType || !body.message) {
      throw new Error("eventType and message are required");
    }

    const language = supportedLanguageSchema.safeParse(body.messageLanguage ?? session.preferredLanguage ?? "en");
    const event = await recordEnterpriseMultilingualEvent(
      session,
      {
        eventType: body.eventType,
        severity: body.severity ?? "info",
        sourceModule: body.sourceModule ?? null,
        entityTable: body.entityTable ?? null,
        entityId: body.entityId ?? null,
        message: body.message,
        messageLanguage: language.success ? language.data : "en",
        payload: body.payload ?? {},
        notifyEmail: body.notifyEmail ?? false,
        notifyMobile: body.notifyMobile ?? false
      },
      request
    );

    return apiCreated({ event });
  } catch (error) {
    return handleApiError(error);
  }
}


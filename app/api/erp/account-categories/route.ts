import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireErpSession } from "@/lib/auth/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { withLocalPg } from "@/lib/db/local-postgres";
import { getRequestLanguage } from "@/lib/i18n/server";
import { localizeRecordFields } from "@/lib/i18n/localize-records";
import { syncRecordTranslations } from "@/lib/i18n/record-translation-sync";
import { apiOk, apiCreated, handleApiError, ApiClientError } from "@/lib/api/response";

const createCategorySchema = z.object({
  name: z.string().trim().min(1, "Category name is required").max(200),
  code: z.string().trim().max(50).optional().nullable(),
  operationalDomain: z.enum(["business", "shipping"]).default("business"),
  description: z.string().trim().max(500).optional().nullable(),
  sortOrder: z.coerce.number().int().default(0)
});

export async function GET(request: NextRequest) {
  try {
    const session = await requireErpSession();
    const domain = request.nextUrl.searchParams.get("operationalDomain");
    const requestedLang = request.nextUrl.searchParams.get("language") || request.nextUrl.searchParams.get("lang");
    const lang = await getRequestLanguage(requestedLang);

    const rows = await withLocalPg(async (sql) => {
      if (domain && (domain === "business" || domain === "shipping")) {
        return await sql`
          select id, code, name, operational_domain, description, is_system, is_active, sort_order, created_at, updated_at
          from public.account_categories
          where deleted_at is null
            and operational_domain = ${domain}
          order by sort_order asc, name asc
        `;
      }
      return await sql`
        select id, code, name, operational_domain, description, is_system, is_active, sort_order, created_at, updated_at
        from public.account_categories
        where deleted_at is null
        order by sort_order asc, name asc
      `;
    });

    let localized = (rows ?? []) as any[];
    try {
      localized = await localizeRecordFields<any>(localized, "account_categories", ["name", "description"], lang);
    } catch {
      localized = (rows ?? []) as any[];
    }

    return apiOk({
      categories: localized
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireErpSession();
    const body = await request.json();
    const parsed = createCategorySchema.parse(body);

    const generatedCode =
      parsed.code?.trim().toUpperCase() ||
      parsed.name.replace(/[^a-zA-Z0-9]/g, "_").toUpperCase().slice(0, 20) ||
      "CAT";

    const result = await withLocalPg(async (sql) => {
      // Check existing
      const existing = await sql`
        select id, code, name, operational_domain
        from public.account_categories
        where lower(name) = lower(${parsed.name})
          and operational_domain = ${parsed.operationalDomain}
          and deleted_at is null
        limit 1
      `;
      if (existing.length > 0) {
        throw new ApiClientError(
          `Category "${parsed.name}" already exists for ${parsed.operationalDomain === "shipping" ? "Shipping Line & Clearing Agent" : "Business"}.`
        );
      }

      const rows = await sql`
        insert into public.account_categories (
          code,
          name,
          operational_domain,
          description,
          is_system,
          is_active,
          sort_order
        ) values (
          ${generatedCode},
          ${parsed.name},
          ${parsed.operationalDomain},
          ${parsed.description || null},
          false,
          true,
          ${parsed.sortOrder}
        )
        returning id, code, name, operational_domain, description, is_system, is_active, sort_order, created_at, updated_at
      `;
      return rows[0];
    });

    if (result?.id) {
      void syncRecordTranslations({
        table: "account_categories",
        recordId: result.id,
        record: {
          name: parsed.name,
          description: parsed.description || null
        },
        originalLanguage: session.preferredLanguage || "en",
        actorId: session.userId
      }).catch((err) => console.error("Category translation sync error:", err));
    }

    return apiCreated({
      category: result
    });
  } catch (error) {
    return handleApiError(error);
  }
}

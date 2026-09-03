import { NextRequest } from "next/server";
import { z } from "zod";
import { apiOk, apiCreated, handleApiError } from "@/lib/api/response";
import { requireErpSession } from "@/lib/auth/session";
import { authorize, resolveReportScope, enforceScopeFilters } from "@/lib/permissions/middleware";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { generateLocalTranslations } from "@/lib/i18n/auto-translate-record";

const taxSchema = z.object({
  id: z.string().uuid().optional(),
  countryId: z.string().uuid("Valid country ID is required"),
  taxName: z.string().min(1, "Tax name is required"),
  taxCode: z.string().min(1, "Tax code is required"),
  taxRate: z.coerce.number().min(0, "Tax rate must be 0 or greater").max(100, "Tax rate cannot exceed 100%"),
  trnNumber: z.string().optional().or(z.literal("")),
  appliesTo: z.enum(["purchase", "sales", "both", "expense"]).default("both"),
  isDefault: z.boolean().default(false),
  isActive: z.boolean().default(true)
});

/**
 * GET /api/erp/tax?countryId=<uuid>
 *
 * Retrieves tax settings for a country or all countries (Super Admin).
 */
export async function GET(request: NextRequest) {
  try {
    const session = await requireErpSession();
    const scope = resolveReportScope(session);

    const requestedCountryId = request.nextUrl.searchParams.get("countryId");
    const { effectiveCountryId } = enforceScopeFilters(
      scope,
      requestedCountryId && requestedCountryId !== "all" ? requestedCountryId : null,
      null
    );

    const admin = createSupabaseAdminClient() as any;

    // Query country_tax_settings table
    let query = admin
      .from("country_tax_settings")
      .select("id, country_id, tax_name, tax_code, tax_rate, trn_number, applies_to, is_default, is_active, created_at, updated_at, countries(id, name, iso2, currency_code)")
      .order("created_at", { ascending: false });

    if (effectiveCountryId) {
      query = query.eq("country_id", effectiveCountryId);
    }

    const { data: taxRows, error } = await query;

    if (error) {
      // country_tax_settings is created by migration 20261029. A hard error here
      // means the schema is out of date on this environment — surface it, do not
      // silently serve preset data as if it were real configuration.
      throw new Error(`Tax settings unavailable: ${error.message}`);
    }

    let taxes = (taxRows ?? []).map((t: any) => ({
      id: t.id,
      countryId: t.country_id,
      countryName: t.countries?.name || "Global",
      taxName: t.tax_name,
      taxCode: t.tax_code,
      taxRate: Number(t.tax_rate || 0),
      trnNumber: t.trn_number || "",
      appliesTo: t.applies_to || "both",
      isDefault: Boolean(t.is_default),
      isActive: Boolean(t.is_active),
      createdAt: t.created_at
    }));

    return apiOk({
      scope: {
        level: scope.level,
        countryId: effectiveCountryId
      },
      taxes
    });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * POST /api/erp/tax
 *
 * Creates or updates a country tax setting.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await requireErpSession();
    authorize(session, { resource: "settings", action: "write" });

    const body = await request.json();
    const parsed = taxSchema.parse(body);

    const scope = resolveReportScope(session);

    // Super admin can edit any country; a scoped admin may only touch their own
    // country — and a scoped session with no country resolved cannot write at all.
    if (scope.level !== "global" && (!scope.countryId || parsed.countryId !== scope.countryId)) {
      return handleApiError(new Error("You do not have permission to manage tax settings for this country."));
    }

    const admin = createSupabaseAdminClient() as any;
    const nameTranslations = generateLocalTranslations(parsed.taxName);

    // Upsert payload
    const payload = {
      country_id: parsed.countryId,
      tax_name: parsed.taxName,
      tax_code: parsed.taxCode,
      tax_rate: parsed.taxRate,
      trn_number: parsed.trnNumber || null,
      applies_to: parsed.appliesTo,
      is_default: parsed.isDefault,
      is_active: parsed.isActive,
      updated_at: new Date().toISOString()
    };

    if (parsed.id) {
      (payload as any).id = parsed.id;
    } else {
      (payload as any).created_by = session.userId;
    }

    // If this tax is set as default, clear previous defaults for this country
    if (parsed.isDefault) {
      await admin
        .from("country_tax_settings")
        .update({ is_default: false })
        .eq("country_id", parsed.countryId);
    }

    const { data, error } = await admin
      .from("country_tax_settings")
      .upsert(payload, { onConflict: "id" })
      .select()
      .single();

    if (error) {
      // Do not pretend the save succeeded — the caller must know it failed.
      throw new Error(`Could not save tax setting: ${error.message}`);
    }

    return apiCreated({
      saved: true,
      tax: {
        id: data.id,
        countryId: data.country_id,
        taxName: data.tax_name,
        taxCode: data.tax_code,
        taxRate: Number(data.tax_rate),
        trnNumber: data.trn_number,
        appliesTo: data.applies_to,
        isDefault: data.is_default,
        isActive: data.is_active,
        translations: nameTranslations
      }
    });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * DELETE /api/erp/tax?id=<uuid>
 */
export async function DELETE(request: NextRequest) {
  try {
    const session = await requireErpSession();
    authorize(session, { resource: "settings", action: "write" });

    const taxId = request.nextUrl.searchParams.get("id");
    if (!taxId) {
      return handleApiError(new Error("Tax ID parameter is required"));
    }

    const admin = createSupabaseAdminClient() as any;
    const scope = resolveReportScope(session);

    // A scoped admin may only delete a row that belongs to their own country —
    // never one addressed only by id.
    if (scope.level !== "global") {
      if (!scope.countryId) {
        return handleApiError(new Error("You do not have permission to delete tax settings."));
      }
      const { data: row } = await admin
        .from("country_tax_settings")
        .select("country_id")
        .eq("id", taxId)
        .maybeSingle();
      if (row && row.country_id !== scope.countryId) {
        return handleApiError(new Error("You do not have permission to delete this tax setting."));
      }
    }

    const { error } = await admin.from("country_tax_settings").delete().eq("id", taxId);

    if (error) {
      throw new Error(`Could not delete tax setting: ${error.message}`);
    }

    return apiOk({ deleted: true, id: taxId });
  } catch (error) {
    return handleApiError(error);
  }
}

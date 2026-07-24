import { NextRequest } from "next/server";
import { z } from "zod";
import { apiCreated, apiOk, handleApiError } from "@/lib/api/response";
import { requireErpSession } from "@/lib/auth/session";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import { createApiSupabaseClient, requireSupabaseData } from "@/lib/api/supabase";
import { uuidSchema } from "@/lib/api/erp-validation";

const ruleSchema = z.object({
  contactTypeKey: z.enum(["mobile", "phone", "whatsapp", "fax", "extension"]),
  callingCode: z.string().trim().regex(/^\\+[0-9]{1,6}$/),
  prefix: z.string().trim().max(20).optional().nullable(),
  formatMask: z.string().trim().max(120).optional().nullable(),
  example: z.string().trim().max(120).optional().nullable(),
  isActive: z.coerce.boolean().default(true)
});

export async function GET(request: NextRequest) {
  try {
    const session = await requireErpSession();
    authorizeApiScope(session, { resource: "settings", action: "read" });

    const countryId = request.nextUrl.searchParams.get("countryId");
    const parsedCountryId = countryId ? uuidSchema.parse(countryId) : null;

    const supabase = await createApiSupabaseClient();

    const contactTypes = (await requireSupabaseData(
      supabase
        .from("contact_types")
        .select("id, key, name, is_active, sort_order")
        .is("deleted_at", null)
        .order("sort_order", { ascending: true })
        .limit(200)
    )) as any[];

    let rules: any[] = [];
    if (parsedCountryId) {
      rules = (await requireSupabaseData(
        supabase
          .from("country_contact_type_rules")
          .select("id, country_id, contact_type_id, calling_code, prefix, format_mask, example, is_active")
          .eq("country_id", parsedCountryId)
          .is("deleted_at", null)
          .limit(200)
      )) as any[];
    }

    // Join rules with contact type keys for easier client usage.
    const ctById = new Map((contactTypes ?? []).map((ct: any) => [ct.id, ct]));
    const joinedRules = (rules ?? [])
      .map((r: any) => {
        const ct = ctById.get(r.contact_type_id);
        if (!ct) return null;
        return {
          id: r.id,
          countryId: r.country_id,
          contactTypeId: r.contact_type_id,
          contactTypeKey: ct.key,
          contactTypeName: ct.name,
          callingCode: r.calling_code,
          prefix: r.prefix,
          formatMask: r.format_mask,
          example: r.example,
          isActive: r.is_active
        };
      })
      .filter(Boolean);

    return apiOk({
      countryId: parsedCountryId,
      contactTypes: contactTypes ?? [],
      rules: joinedRules
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireErpSession();
    authorizeApiScope(session, { resource: "settings", action: "update" });

    const body = z
      .object({
        countryId: uuidSchema,
        rules: z.array(ruleSchema).min(1)
      })
      .parse(await request.json());

    const supabase = await createApiSupabaseClient();

    const contactTypes = (await requireSupabaseData(
      supabase.from("contact_types").select("id, key").is("deleted_at", null).limit(200)
    )) as any[];

    const typeIdByKey = new Map((contactTypes ?? []).map((ct: any) => [ct.key, ct.id]));

    const payload = body.rules.map((r) => ({
      country_id: body.countryId,
      contact_type_id: typeIdByKey.get(r.contactTypeKey),
      calling_code: r.callingCode,
      prefix: r.prefix ?? null,
      format_mask: r.formatMask ?? null,
      example: r.example ?? null,
      is_active: r.isActive
    }));

    if (payload.some((p) => !p.contact_type_id)) {
      throw new Error("One or more contactTypeKey values are invalid.");
    }

    // Upsert by unique(country_id, contact_type_id)
    const { error } = await supabase
      .from("country_contact_type_rules")
      .upsert(payload as any, { onConflict: "country_id,contact_type_id" });
    if (error) throw new Error(error.message);

    return apiCreated({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}

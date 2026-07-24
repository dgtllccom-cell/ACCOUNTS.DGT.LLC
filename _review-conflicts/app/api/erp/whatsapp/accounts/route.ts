import { NextRequest } from "next/server";
import { z } from "zod";
import { apiCreated, apiOk, handleApiError } from "@/lib/api/response";
import { requireErpSession } from "@/lib/auth/session";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const accountCreateSchema = z.object({
  scope: z.enum(["super_admin", "country", "country_branch", "city_branch"]),
  countryId: z.string().uuid().nullable().optional(),
  countryBranchId: z.string().uuid().nullable().optional(),
  cityBranchId: z.string().uuid().nullable().optional(),
  displayName: z.string().min(2).max(100),
  phoneNumber: z.string().min(7).max(20),
  phoneNumberId: z.string().min(1),
  wabaId: z.string().min(1),
  accessToken: z.string().min(1),
  verifyToken: z.string().optional()
});

export async function GET(request: NextRequest) {
  try {
    const session = await requireErpSession();
    authorizeApiScope(session, { resource: "whatsapp", action: "read" });

    const supabase = await createServerSupabaseClient();
    let query = (supabase as any)
      .from("whatsapp_accounts")
      .select(`
        id, scope, display_name, phone_number, phone_number_id, waba_id,
        is_active, is_default, webhook_registered,
        country_id, country_branch_id, city_branch_id,
        created_at, updated_at,
        countries:country_id(id, name),
        country_branches:country_branch_id(id, name),
        city_branches:city_branch_id(id, name, city_name)
      `)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    // Non-super-admins are scoped by RLS automatically, but also filter client-side
    if (!session.isSuperAdmin) {
      if (session.cityBranchIds.length > 0) {
        query = query.in("city_branch_id", session.cityBranchIds);
      } else if (session.countryIds.length > 0) {
        query = query.in("country_id", session.countryIds);
      }
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);

    return apiOk(data ?? []);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireErpSession();
    const body = accountCreateSchema.parse(await request.json());
    const supabase = createSupabaseAdminClient();

    let countryId = body.countryId ?? null;
    let countryBranchId = body.countryBranchId ?? null;
    let cityBranchId = body.cityBranchId ?? null;

    // Resolve scope IDs if they are not provided
    if (body.scope === "city_branch") {
      if (!cityBranchId && session.cityBranchIds.length > 0) {
        cityBranchId = session.cityBranchIds[0];
      }
      if (cityBranchId) {
        const { data: cb } = await (supabase as any)
          .from("city_branches")
          .select("country_id, country_branch_id")
          .eq("id", cityBranchId)
          .maybeSingle();
        if (cb) {
          countryId = cb.country_id;
          countryBranchId = cb.country_branch_id;
        }
      }
    } else if (body.scope === "country_branch") {
      if (!countryBranchId && session.countryBranchIds.length > 0) {
        countryBranchId = session.countryBranchIds[0];
      }
      if (countryBranchId) {
        const { data: cb } = await (supabase as any)
          .from("country_branches")
          .select("country_id")
          .eq("id", countryBranchId)
          .maybeSingle();
        if (cb) {
          countryId = cb.country_id;
        }
      }
    } else if (body.scope === "country") {
      if (!countryId && session.countryIds.length > 0) {
        countryId = session.countryIds[0];
      }
    }

    // Enforce scope integrity constraints
    if (body.scope === "super_admin") {
      countryId = null;
      countryBranchId = null;
      cityBranchId = null;
    } else if (body.scope === "country") {
      countryBranchId = null;
      cityBranchId = null;
    } else if (body.scope === "country_branch") {
      cityBranchId = null;
    }

    console.log("[WhatsApp Account Auto-Resolve] Inserting WhatsApp Account Payload:", {
      scope: body.scope,
      countryId,
      countryBranchId,
      cityBranchId,
      displayName: body.displayName,
      phoneNumber: body.phoneNumber,
      phoneNumberId: body.phoneNumberId,
      wabaId: body.wabaId
    });

    authorizeApiScope(session, {
      resource: "whatsapp",
      action: "delete",
      countryId,
      countryBranchId,
      cityBranchId
    });

    const { data, error } = await (supabase as any)
      .from("whatsapp_accounts")
      .insert({
        scope: body.scope,
        country_id: countryId,
        country_branch_id: countryBranchId,
        city_branch_id: cityBranchId,
        display_name: body.displayName,
        phone_number: body.phoneNumber,
        phone_number_id: body.phoneNumberId,
        waba_id: body.wabaId,
        access_token: body.accessToken,
        verify_token: body.verifyToken ?? null,
        created_by: session.userId
      })
      .select("id")
      .single();

    if (error) throw new Error(error.message);

    return apiCreated({ accountId: data.id });
  } catch (error) {
    return handleApiError(error);
  }
}

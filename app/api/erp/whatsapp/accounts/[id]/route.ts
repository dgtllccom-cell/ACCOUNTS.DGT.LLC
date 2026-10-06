import { NextRequest } from "next/server";
import { z } from "zod";
import { apiOk, handleApiError } from "@/lib/api/response";
import { requireErpSession } from "@/lib/auth/session";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const accountUpdateSchema = z.object({
  displayName: z.string().min(2).max(100).optional(),
  isActive: z.boolean().optional(),
  isDefault: z.boolean().optional(),
  accessToken: z.string().min(1).optional(),
  settings: z.record(z.unknown()).optional()
});

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const session = await requireErpSession();
    const { id } = await params;
    const body = accountUpdateSchema.parse(await request.json());

    const supabase = createSupabaseAdminClient();

    // Load account to check scope ownership
    const { data: account, error: fetchError } = await (supabase as any)
      .from("whatsapp_accounts")
      .select("id, country_id, country_branch_id, city_branch_id")
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle();

    if (fetchError || !account) return apiOk({ error: "Not found" });

    authorizeApiScope(session, {
      resource: "whatsapp",
      action: "delete",
      countryId: account.country_id,
      countryBranchId: account.country_branch_id,
      cityBranchId: account.city_branch_id
    });

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (body.displayName !== undefined) updates.display_name = body.displayName;
    if (body.isActive !== undefined) updates.is_active = body.isActive;
    if (body.isDefault !== undefined) updates.is_default = body.isDefault;
    if (body.accessToken !== undefined) updates.access_token = body.accessToken;
    if (body.settings !== undefined) updates.settings = body.settings;

    const { error } = await (supabase as any)
      .from("whatsapp_accounts")
      .update(updates)
      .eq("id", id);

    if (error) throw new Error(error.message);

    return apiOk({ accountId: id });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const session = await requireErpSession();
    const { id } = await params;

    const supabase = createSupabaseAdminClient();

    const { data: account } = await (supabase as any)
      .from("whatsapp_accounts")
      .select("id, country_id, country_branch_id, city_branch_id")
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle();

    if (!account) return apiOk({ error: "Not found" });

    authorizeApiScope(session, {
      resource: "whatsapp",
      action: "delete",
      countryId: account.country_id,
      countryBranchId: account.country_branch_id,
      cityBranchId: account.city_branch_id
    });

    await (supabase as any)
      .from("whatsapp_accounts")
      .update({ deleted_at: new Date().toISOString(), is_active: false })
      .eq("id", id);

    return apiOk({ deleted: true });
  } catch (error) {
    return handleApiError(error);
  }
}

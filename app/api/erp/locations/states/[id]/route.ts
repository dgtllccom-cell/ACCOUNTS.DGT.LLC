import { NextRequest } from "next/server";
import { apiOk, handleApiError } from "@/lib/api/response";
import { requireErpSession } from "@/lib/auth/session";
import { locationsRepository } from "@/lib/repositories/locations-repository";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireErpSession();
    if (!session.isSuperAdmin && !session.countryIds.length) throw new Error("Location write is not allowed.");

    const { id } = await params;
    const body = (await request.json()) as { name?: string | null; code?: string | null; isActive?: boolean | null };
    const state = await locationsRepository.updateState({
      stateId: id,
      name: body.name,
      code: body.code,
      isActive: body.isActive
    });

    if (!session.isSuperAdmin && !session.countryIds.includes(state.country_id)) {
      throw new Error("Country scope is not allowed.");
    }

    return apiOk({ state });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireErpSession();
    if (!session.isSuperAdmin && !session.countryIds.length) throw new Error("Location write is not allowed.");

    const { id } = await params;
    const { createSupabaseAdminClient } = await import("@/lib/supabase/admin");
    const supabase = createSupabaseAdminClient() as any;
    const { data: state, error: fetchError } = await supabase
      .from("states_provinces")
      .select("country_id")
      .eq("id", id)
      .is("deleted_at", null)
      .single();

    if (fetchError || !state) {
      throw new Error("State not found or already deleted");
    }

    if (!session.isSuperAdmin && !session.countryIds.includes(state.country_id)) {
      throw new Error("Country scope is not allowed.");
    }

    await locationsRepository.deleteState(id);
    return apiOk({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}

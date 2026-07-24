import { NextRequest } from "next/server";
import { apiOk, handleApiError } from "@/lib/api/response";
import { requireErpSession } from "@/lib/auth/session";
import { applySessionScopeDefaults, resolveCommunicationSender } from "@/lib/communication-center/communication-center-service";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

function clean(value: string | null) {
  return value && value !== "all" ? value : null;
}

export async function GET(req: NextRequest) {
  try {
    const session = await requireErpSession();
    const admin = createSupabaseAdminClient() as any;
    const { searchParams } = new URL(req.url);
    const scope = applySessionScopeDefaults(session, {
      countryId: clean(searchParams.get("countryId")),
      countryBranchId: clean(searchParams.get("countryBranchId")),
      cityBranchId: clean(searchParams.get("cityBranchId"))
    });

    const sender = await resolveCommunicationSender(admin, scope);
    return apiOk({ sender, scope });
  } catch (error) {
    return handleApiError(error);
  }
}

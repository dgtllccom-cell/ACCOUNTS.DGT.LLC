import { NextRequest } from "next/server";
import { z } from "zod";
import { apiOk, handleApiError, ApiClientError } from "@/lib/api/response";
import { requireErpSession } from "@/lib/auth/session";
import { optionalUuidSchema, roleNameSchema } from "@/lib/api/erp-validation";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { issueNextUserCode } from "@/lib/services/user-identity-service";
import { isUserCreator, canDelegateUserRole } from "@/lib/permissions/user-management-scope";

const querySchema = z.object({
  role: roleNameSchema,
  countryId: optionalUuidSchema.default(null)
});

export async function GET(request: NextRequest) {
  try {
    const session = await requireErpSession();
    const query = querySchema.parse({
      role: request.nextUrl.searchParams.get("role"),
      countryId: request.nextUrl.searchParams.get("countryId")
    });

    // Keep security consistent with user creation rules.
    if (!session.isSuperAdmin) {
      if (!isUserCreator(session) || !canDelegateUserRole(session, query.role)) {
        throw new ApiClientError("Not authorized to generate a code for this role.", { status: 403 });
      }
      if (query.countryId && !session.countryIds.includes(query.countryId)) {
        throw new ApiClientError("Country scope is not allowed.", { status: 403 });
      }
    }

    const admin = createSupabaseAdminClient() as any;
    const code = await issueNextUserCode(admin, { role: query.role, countryId: query.countryId ?? null });

    return apiOk({ code });
  } catch (error) {
    return handleApiError(error);
  }
}


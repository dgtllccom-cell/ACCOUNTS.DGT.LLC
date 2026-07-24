import { NextRequest } from "next/server";
import { z } from "zod";
import { apiOk, handleApiError } from "@/lib/api/response";
import { requireErpSession } from "@/lib/auth/session";
import { optionalUuidSchema, roleNameSchema } from "@/lib/api/erp-validation";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { issueNextUserCode } from "@/lib/services/user-identity-service";

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
    const isCountryManager = session.roles.some((r) => r === "country_admin" || r === "main_branch_admin");
    if (!session.isSuperAdmin) {
      if (!isCountryManager) throw new Error("Not authorized to generate user codes.");
      if (query.role === "super_admin" || query.role === "country_admin") {
        throw new Error("Only Super Admin can create Super Admin or Country Admin users.");
      }
      if (query.countryId && !session.countryIds.includes(query.countryId)) {
        throw new Error("Country scope is not allowed.");
      }
    }

    const admin = createSupabaseAdminClient() as any;
    const code = await issueNextUserCode(admin, { role: query.role, countryId: query.countryId ?? null });

    return apiOk({ code });
  } catch (error) {
    return handleApiError(error);
  }
}


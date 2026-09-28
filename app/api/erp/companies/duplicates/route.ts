import { NextRequest } from "next/server";
import { apiOk, handleApiError } from "@/lib/api/response";
import { requireErpSession } from "@/lib/auth/session";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import { findCompanyDuplicates } from "@/lib/services/company-master-service";

/**
 * GET /api/erp/companies/duplicates?name=&legalName=&registrationNumber=&taxNumber=&ownerPersonId=&countryId=&excludeId=
 *
 * Live duplicate check for the Company Master form (the same check the create/update routes
 * enforce with a 409). Read-only; results are limited to companies the caller may see.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await requireErpSession();
    authorizeApiScope(session, { resource: "companies", action: "read" });
    const q = request.nextUrl.searchParams;
    const uuidOrNull = (v: string | null) => (v && /^[0-9a-f-]{36}$/i.test(v) ? v : null);
    const candidates = await findCompanyDuplicates(session, {
      name: q.get("name"),
      legalName: q.get("legalName"),
      registrationNumber: q.get("registrationNumber"),
      taxNumber: q.get("taxNumber"),
      ownerPersonId: uuidOrNull(q.get("ownerPersonId")),
      countryId: uuidOrNull(q.get("countryId")),
      excludeId: uuidOrNull(q.get("excludeId")),
    });
    return apiOk({ candidates });
  } catch (error) {
    return handleApiError(error);
  }
}

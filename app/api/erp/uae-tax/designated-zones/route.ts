import { apiOk, handleApiError } from "@/lib/api/response";
import { requireErpSession } from "@/lib/auth/session";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import { uaeTaxService } from "@/lib/services/uae-tax-service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const session = await requireErpSession();
    authorizeApiScope(session, { resource: "uae_tax", action: "read" });
    const zones = await uaeTaxService.listDesignatedZones();
    return apiOk({ zones });
  } catch (error) {
    return handleApiError(error);
  }
}

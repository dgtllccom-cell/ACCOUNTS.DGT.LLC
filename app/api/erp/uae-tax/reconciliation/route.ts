import { apiOk, handleApiError } from "@/lib/api/response";
import { guardUaeTax } from "@/lib/services/uae-tax-api";
import { uaeTaxService } from "@/lib/services/uae-tax-service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const { scope } = await guardUaeTax("read");
    const rows = await uaeTaxService.getReconciliation(scope);
    return apiOk({ rows });
  } catch (error) {
    return handleApiError(error);
  }
}

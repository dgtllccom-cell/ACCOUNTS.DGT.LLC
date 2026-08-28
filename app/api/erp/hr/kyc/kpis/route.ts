import { apiOk, handleApiError } from "@/lib/api/response";
import { guardHr } from "@/lib/services/hr-api";
import { hrKycService } from "@/lib/services/hr-kyc-service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const { scope } = await guardHr("read");
    const kpis = await hrKycService.kpis(scope);
    return apiOk({ kpis });
  } catch (error) {
    return handleApiError(error);
  }
}

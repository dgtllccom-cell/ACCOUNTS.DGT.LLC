import { apiOk, handleApiError } from "@/lib/api/response";
import { guardContracts } from "@/lib/services/contract-register-api";
import { contractRegisterService } from "@/lib/services/contract-register-service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const { scope } = await guardContracts("read");
    const kpis = await contractRegisterService.kpis(scope);
    return apiOk({ kpis });
  } catch (error) {
    return handleApiError(error);
  }
}

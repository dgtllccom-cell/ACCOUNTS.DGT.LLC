import { apiOk, handleApiError } from "@/lib/api/response";
import { guardHr } from "@/lib/services/hr-api";
import { hrGratuityService } from "@/lib/services/hr-gratuity-service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const { scope } = await guardHr("read");
    const rows = await hrGratuityService.policies(scope);
    return apiOk({ rows });
  } catch (error) {
    return handleApiError(error);
  }
}

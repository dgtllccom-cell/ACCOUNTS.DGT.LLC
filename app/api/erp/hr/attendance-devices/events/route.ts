import { NextRequest } from "next/server";
import { apiOk, handleApiError } from "@/lib/api/response";
import { guardHr } from "@/lib/services/hr-api";
import { listDeviceEvents } from "@/lib/services/hr-biometric-attendance-service";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { session } = await guardHr("read");
    const q = request.nextUrl.searchParams;
    return apiOk({ events: await listDeviceEvents(session, { status: q.get("status"), limit: Number(q.get("limit") || 200) }) });
  } catch (error) {
    return handleApiError(error);
  }
}

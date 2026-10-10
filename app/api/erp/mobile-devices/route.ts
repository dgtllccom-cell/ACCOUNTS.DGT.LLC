import { NextRequest } from "next/server";
import { apiOk, handleApiError, rethrowIfNextControlFlow } from "@/lib/api/response";
import { listDevices } from "@/lib/mobile/device-service";
import { requireSuperAdminSession } from "@/lib/mobile/device-admin";

export async function GET(req: NextRequest) {
  try {
    await requireSuperAdminSession();
    const rows = await listDevices(req.nextUrl.searchParams.get("status") ?? undefined);
    return apiOk({ devices: rows.map((d) => ({ ...d, code_hash: undefined })) });
  } catch (e) {
    rethrowIfNextControlFlow(e);
    return handleApiError(e);
  }
}

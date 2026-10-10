import { NextRequest } from "next/server";
import { apiOk, handleApiError, ApiClientError } from "@/lib/api/response";
import { DEVICE_COOKIE, verifyActivationCode, verifyDeviceToken } from "@/lib/mobile/device-service";
import { clientIp } from "@/lib/mobile/device-http";

/** Public: the user types the one-time code the Super Admin gave them. */
export async function POST(req: NextRequest) {
  try {
    const id = verifyDeviceToken(req.cookies.get(DEVICE_COOKIE)?.value);
    if (!id) throw new ApiClientError("Request activation first.", { status: 409, code: "NO_DEVICE" });
    const b = await req.json().catch(() => ({}));
    return apiOk(await verifyActivationCode(id, b?.code, clientIp(req)));
  } catch (e) {
    return handleApiError(e);
  }
}

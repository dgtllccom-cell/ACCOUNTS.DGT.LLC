import { NextRequest } from "next/server";
import { apiOk, handleApiError } from "@/lib/api/response";
import { DEVICE_COOKIE, getDevice, summarize, verifyDeviceToken } from "@/lib/mobile/device-service";

/** Public: where is THIS device in the approval flow? (none | pending | approved | active | rejected | revoked) */
export async function GET(req: NextRequest) {
  try {
    const id = verifyDeviceToken(req.cookies.get(DEVICE_COOKIE)?.value);
    if (!id) return apiOk({ status: "none" });
    const d = await getDevice(id);
    return apiOk(d ? summarize(d) : { status: "none" });
  } catch (e) {
    return handleApiError(e);
  }
}

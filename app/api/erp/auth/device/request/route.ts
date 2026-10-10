import { NextRequest } from "next/server";
import { apiOk, handleApiError } from "@/lib/api/response";
import { ApiClientError } from "@/lib/api/response";
import { createDeviceRequest, summarize } from "@/lib/mobile/device-service";
import { clientIp, requestApp, setDeviceCookie } from "@/lib/mobile/device-http";

/** Public (no ERP login): a freshly installed DGT.llc app asks for activation. Creates a PENDING request only — no access. */
export async function POST(req: NextRequest) {
  try {
    const b = await req.json().catch(() => ({}));
    const app = requestApp(req, b?.app);
    if (!app) throw new ApiClientError("Activation can only be requested from the DGT.llc B / BS apps.", { status: 400, code: "NOT_APP" });
    const { device, token } = await createDeviceRequest(
      { app, name: b?.name, phone: b?.phone, identifier: b?.identifier, note: b?.note, platform: b?.platform, model: b?.model, osVersion: b?.osVersion, appVersion: b?.appVersion },
      clientIp(req)
    );
    const res = apiOk(summarize(device));
    setDeviceCookie(res, device.id);
    void token;
    return res;
  } catch (e) {
    return handleApiError(e);
  }
}

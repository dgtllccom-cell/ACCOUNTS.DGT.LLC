import { NextRequest } from "next/server";
import { z } from "zod";
import { apiOk, handleApiError } from "@/lib/api/response";
import { requireErpSession } from "@/lib/auth/session";
import { registerMobileDevicePushToken, sendMobilePushNotification } from "@/lib/services/mobile-push-service";

const registerTokenSchema = z.object({
  deviceToken: z.string().min(1, "Device token is required"),
  platform: z.enum(["ios", "android", "web"]).default("android"),
  deviceName: z.string().optional()
});

/**
 * POST /api/erp/mobile/push
 * Registers a native mobile device token or sends a test push alert
 */
export async function POST(request: NextRequest) {
  try {
    const session = await requireErpSession();
    const body = await request.json();

    const { searchParams } = request.nextUrl;
    if (searchParams.get("action") === "send") {
      const result = await sendMobilePushNotification({
        title: body.title || "AI Mobile Alert",
        body: body.body || "New message received in Return WhatsApp Reply",
        userId: session.userId
      });
      return apiOk({ action: "send", ...result });
    }

    const parsed = registerTokenSchema.parse(body);
    const registered = await registerMobileDevicePushToken({
      userId: session.userId,
      deviceToken: parsed.deviceToken,
      platform: parsed.platform,
      deviceName: parsed.deviceName
    });

    return apiOk({ ...registered });
  } catch (error) {
    return handleApiError(error);
  }
}

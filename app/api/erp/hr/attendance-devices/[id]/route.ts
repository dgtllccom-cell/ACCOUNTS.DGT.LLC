import { NextRequest } from "next/server";
import { z } from "zod";
import { apiOk, handleApiError } from "@/lib/api/response";
import { guardHr } from "@/lib/services/hr-api";
import { rotateDeviceKey, setDeviceActive } from "@/lib/services/hr-biometric-attendance-service";

export const dynamic = "force-dynamic";
const bodySchema = z.object({ action: z.enum(["rotate_key", "activate", "deactivate"]) });

export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { session } = await guardHr("write");
    const { id } = z.object({ id: z.string().uuid() }).parse(await ctx.params);
    const { action } = bodySchema.parse(await request.json());
    if (action === "rotate_key") return apiOk(await rotateDeviceKey(session, id));
    await setDeviceActive(session, id, action === "activate");
    return apiOk({ id, active: action === "activate" });
  } catch (error) {
    return handleApiError(error);
  }
}

import { NextRequest } from "next/server";
import { z } from "zod";
import { apiOk, handleApiError, rethrowIfNextControlFlow } from "@/lib/api/response";
import { deviceEvents } from "@/lib/mobile/device-service";
import { requireSuperAdminSession } from "@/lib/mobile/device-admin";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireSuperAdminSession();
    const { id } = await ctx.params;
    return apiOk({ events: await deviceEvents(z.string().uuid().parse(id)) });
  } catch (e) {
    rethrowIfNextControlFlow(e);
    return handleApiError(e);
  }
}

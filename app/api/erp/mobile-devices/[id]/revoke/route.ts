import { NextRequest } from "next/server";
import { z } from "zod";
import { apiOk, handleApiError, rethrowIfNextControlFlow } from "@/lib/api/response";
import { revokeDevice } from "@/lib/mobile/device-service";
import { requireSuperAdminSession } from "@/lib/mobile/device-admin";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSuperAdminSession();
    const id = z.string().uuid().parse((await ctx.params).id);
    const b = await req.json().catch(() => ({}));
    const note = typeof b?.note === "string" ? b.note.slice(0, 300) : undefined;
    await revokeDevice(id, session.userId, note); return apiOk({ ok: true });
  } catch (e) {
    rethrowIfNextControlFlow(e);
    return handleApiError(e);
  }
}

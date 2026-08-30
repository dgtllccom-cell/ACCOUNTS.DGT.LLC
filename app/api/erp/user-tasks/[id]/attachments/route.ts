import { NextRequest } from "next/server";
import { z } from "zod";
import { apiCreated, apiError, apiOk } from "@/lib/api/response";
import { requireTaskSession, taskErrorResponse } from "@/lib/user-tasks/route-helpers";
import { addAttachment, deleteAttachment } from "@/lib/user-tasks/service";

export const dynamic = "force-dynamic";

const schema = z.object({
  kind: z.enum(["instruction", "evidence"]).optional(),
  name: z.string().trim().min(1).max(240),
  mime: z.string().trim().max(160).optional().nullable(),
  sizeBytes: z.number().int().nonnegative().max(25 * 1024 * 1024).optional().nullable(),
  file: z.record(z.any()).optional().nullable(),
  note: z.string().trim().max(2000).optional().nullable(),
});

export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireTaskSession();
  if ("response" in auth) return auth.response;
  const { id } = await ctx.params;
  try {
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return apiError("VALIDATION", "Invalid attachment", 400, parsed.error.flatten());
    const res = await addAttachment(auth.session, id, parsed.data);
    return apiCreated(res);
  } catch (error) {
    return taskErrorResponse(error);
  }
}

export async function DELETE(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireTaskSession();
  if ("response" in auth) return auth.response;
  const { id } = await ctx.params;
  try {
    const attachmentId = new URL(request.url).searchParams.get("attachmentId");
    if (!attachmentId) return apiError("VALIDATION", "attachmentId is required", 400);
    await deleteAttachment(auth.session, id, attachmentId);
    return apiOk({ ok: true });
  } catch (error) {
    return taskErrorResponse(error);
  }
}

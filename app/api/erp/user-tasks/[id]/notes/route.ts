import { NextRequest } from "next/server";
import { z } from "zod";
import { apiCreated, apiError } from "@/lib/api/response";
import { requireTaskSession, taskErrorResponse } from "@/lib/user-tasks/route-helpers";
import { addNote } from "@/lib/user-tasks/service";

export const dynamic = "force-dynamic";

const schema = z.object({
  note: z.string().trim().min(1).max(4000),
  kind: z.enum(["progress_note", "comment"]).optional(),
});

export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireTaskSession();
  if ("response" in auth) return auth.response;
  const { id } = await ctx.params;
  try {
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return apiError("VALIDATION", "Invalid note", 400, parsed.error.flatten());
    await addNote(auth.session, id, { note: parsed.data.note, kind: parsed.data.kind });
    return apiCreated({ ok: true });
  } catch (error) {
    return taskErrorResponse(error);
  }
}

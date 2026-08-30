import { NextRequest } from "next/server";
import { z } from "zod";
import { apiOk, apiCreated, apiError } from "@/lib/api/response";
import { requireDgtSession, dgtErrorResponse } from "@/lib/dgt-connect/route-helpers";
import { listConversations, openDirectConversation, createGroupConversation } from "@/lib/dgt-connect/service";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireDgtSession();
  if ("response" in auth) return auth.response;
  try {
    return apiOk({ conversations: await listConversations(auth.session) });
  } catch (error) {
    return dgtErrorResponse(error);
  }
}

const createSchema = z.union([
  z.object({ kind: z.literal("direct"), userId: z.string().uuid() }),
  z.object({ kind: z.literal("group"), title: z.string().trim().min(1).max(120), memberIds: z.array(z.string().uuid()).min(1).max(50) }),
]);

export async function POST(request: NextRequest) {
  const auth = await requireDgtSession();
  if ("response" in auth) return auth.response;
  try {
    const parsed = createSchema.safeParse(await request.json());
    if (!parsed.success) return apiError("VALIDATION", "Invalid request", 400, parsed.error.flatten());

    const id = parsed.data.kind === "direct"
      ? await openDirectConversation(auth.session, parsed.data.userId)
      : await createGroupConversation(auth.session, parsed.data.title, parsed.data.memberIds);

    return apiCreated({ conversationId: id });
  } catch (error) {
    return dgtErrorResponse(error);
  }
}

import { NextRequest } from "next/server";
import { z } from "zod";
import { apiOk, handleApiError } from "@/lib/api/response";
import { requireErpSession } from "@/lib/auth/session";
import { auditApiAction } from "@/lib/api/audit";

// Every Support Assistant interaction is audited — this endpoint has no read/write
// access to any business record itself, it only logs that guidance was shown and,
// in a future "Allow Once" phase, that a specific record read was consented to.
const supportAuditSchema = z.object({
  action: z.enum(["guidance_opened", "contact_support_clicked"]),
  pathname: z.string().trim().max(300)
});

export async function POST(request: NextRequest) {
  try {
    const session = await requireErpSession();
    const body = supportAuditSchema.parse(await request.json());

    await auditApiAction(request, {
      action: `support.${body.action}`,
      entityTable: "support_assistant",
      entityId: null,
      after: { pathname: body.pathname, role: session.roles[0] ?? null }
    });

    return apiOk({ logged: true });
  } catch (error) {
    return handleApiError(error);
  }
}

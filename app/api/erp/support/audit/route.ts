import { NextRequest } from "next/server";
import { z } from "zod";
import { apiOk, handleApiError } from "@/lib/api/response";
import { requireErpSession } from "@/lib/auth/session";
import { auditApiAction } from "@/lib/api/audit";

// Every Support Assistant interaction is audited — this endpoint has no read/write
// access to any business record itself, it only logs that guidance was shown and,
// in a future "Allow Once" phase, that a specific record read was consented to.
const supportAuditSchema = z.object({
  action: z.enum([
    "guidance_opened",
    "contact_support_clicked",
    "allow_once_requested",
    "allow_once_granted",
    "allow_once_revoked"
  ]),
  pathname: z.string().trim().max(300),
  recordId: z.string().trim().max(100).nullable().optional(),
  reason: z.string().trim().max(500).nullable().optional(),
  durationMinutes: z.number().int().min(5).max(60).optional().default(15)
});

export async function POST(request: NextRequest) {
  try {
    const session = await requireErpSession();
    const body = supportAuditSchema.parse(await request.json());

    const grantToken = body.action === "allow_once_granted" ? crypto.randomUUID() : null;
    const expiresAt =
      body.action === "allow_once_granted"
        ? new Date(Date.now() + (body.durationMinutes || 15) * 60 * 1000).toISOString()
        : null;

    await auditApiAction(request, {
      action: `support.${body.action}`,
      entityTable: "support_assistant",
      entityId: body.recordId || null,
      after: {
        pathname: body.pathname,
        role: session.roles[0] ?? null,
        userId: session.userId,
        reason: body.reason ?? null,
        grantToken,
        expiresAt
      }
    });

    return apiOk({
      logged: true,
      action: body.action,
      grantToken,
      expiresAt
    });
  } catch (error) {
    return handleApiError(error);
  }
}

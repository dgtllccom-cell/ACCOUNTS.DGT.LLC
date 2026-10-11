import { NextRequest } from "next/server";
import { z } from "zod";
import { apiOk, handleApiError, rethrowIfNextControlFlow } from "@/lib/api/response";
import { createReviewPass, listReviewPasses } from "@/lib/mobile/device-service";
import { requireSuperAdminSession } from "@/lib/mobile/device-admin";

const createSchema = z.object({
  app: z.enum(["b", "bs"]),
  label: z.string().trim().min(2).max(80),
  identifier: z.string().trim().min(3).max(160),
  days: z.number().int().min(1).max(90).optional(),
  maxDevices: z.number().int().min(1).max(20).optional(),
});

/** Super Admin: store-review passes (Apple / Google / Samsung reviewers). The code is returned ONCE, never stored in clear text. */
export async function GET() {
  try {
    await requireSuperAdminSession();
    return apiOk({ passes: await listReviewPasses() });
  } catch (e) {
    rethrowIfNextControlFlow(e);
    return handleApiError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireSuperAdminSession();
    const b = createSchema.parse(await req.json().catch(() => ({})));
    const r = await createReviewPass(b, session.userId);
    return apiOk({ id: r.id, code: r.code, expiresAt: r.expiresAt });
  } catch (e) {
    rethrowIfNextControlFlow(e);
    return handleApiError(e);
  }
}

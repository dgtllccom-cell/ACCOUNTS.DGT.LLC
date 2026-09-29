import { NextRequest } from "next/server";
import { z } from "zod";
import { apiOk, handleApiError } from "@/lib/api/response";
import { guardWps } from "@/lib/services/hr-wps-guard";
import { validateRun } from "@/lib/services/hr-wps-service";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { session } = await guardWps("read");
    const q = request.nextUrl.searchParams;
    const p = z.object({ runId: z.string().uuid(), establishmentId: z.string().uuid() }).parse({ runId: q.get("runId"), establishmentId: q.get("establishmentId") });
    const v = await validateRun(session, p.runId, p.establishmentId);
    return apiOk({ run: v.run, establishment: v.establishment, ok: v.ok, issues: v.issues, summary: v.summary });
  } catch (error) {
    return handleApiError(error);
  }
}

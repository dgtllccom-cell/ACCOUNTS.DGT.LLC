import type { NextRequest } from "next/server";
import { z } from "zod";
import { apiOk, handleApiError } from "@/lib/api/response";
import { guardIntake } from "@/lib/services/document-intake-api";
import { documentIntakeService } from "@/lib/services/document-intake-service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const revalidate = 0;

const querySchema = z.object({
  targetModule: z.string().trim().max(120).optional(),
  status: z.enum(["prepared", "consumed", "discarded", "superseded"]).optional(),
  jobId: z.string().uuid().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const { scope } = await guardIntake("read");
    const { searchParams } = new URL(request.url);
    const q = querySchema.parse({
      targetModule: searchParams.get("targetModule") || undefined,
      status: searchParams.get("status") || undefined,
      jobId: searchParams.get("jobId") || undefined,
    });
    const rows = await documentIntakeService.listDrafts(scope, q);
    return apiOk({ rows });
  } catch (error) {
    return handleApiError(error);
  }
}

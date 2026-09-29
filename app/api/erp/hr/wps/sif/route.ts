import { NextRequest } from "next/server";
import { z } from "zod";
import { apiOk, apiCreated, handleApiError } from "@/lib/api/response";
import { guardWps } from "@/lib/services/hr-wps-guard";
import { generateSif, listSifFiles } from "@/lib/services/hr-wps-service";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { session } = await guardWps("read");
    return apiOk({ files: await listSifFiles(session) });
  } catch (error) {
    return handleApiError(error);
  }
}

/** Generate the SIF for a validated payroll run (one live SIF per run). */
export async function POST(request: NextRequest) {
  try {
    const { session } = await guardWps("write");
    const b = z.object({ runId: z.string().uuid(), establishmentId: z.string().uuid() }).parse(await request.json());
    return apiCreated(await generateSif(session, b.runId, b.establishmentId));
  } catch (error) {
    return handleApiError(error);
  }
}

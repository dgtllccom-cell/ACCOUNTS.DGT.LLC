import { NextRequest } from "next/server";
import { z } from "zod";
import { apiOk, handleApiError } from "@/lib/api/response";
import { guardHr } from "@/lib/services/hr-api";
import { importDeviceLog } from "@/lib/services/hr-biometric-attendance-service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** HR uploads a device's exported attendance log (CSV: biometric_id, datetime[, in|out]). */
export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { session } = await guardHr("write");
    const { id } = z.object({ id: z.string().uuid() }).parse(await ctx.params);
    const ct = request.headers.get("content-type") || "";
    let csv = "";
    if (ct.includes("multipart/form-data")) {
      const f = (await request.formData()).get("file");
      if (f instanceof File) csv = await f.text();
    } else if (ct.includes("application/json")) {
      csv = String((await request.json())?.csv ?? "");
    } else {
      csv = await request.text();
    }
    if (csv.length > 5_000_000) throw new Error("File too large.");
    return apiOk(await importDeviceLog(session, id, csv));
  } catch (error) {
    return handleApiError(error);
  }
}

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { handleApiError } from "@/lib/api/response";
import { guardWps } from "@/lib/services/hr-wps-guard";
import { downloadSif } from "@/lib/services/hr-wps-service";

export const dynamic = "force-dynamic";

/** The SIF exactly as generated (integrity-checked); the download is logged. */
export async function GET(_request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { session } = await guardWps("write");
    const { id } = z.object({ id: z.string().uuid() }).parse(await ctx.params);
    const f = await downloadSif(session, id);
    return new NextResponse(f.content, {
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=us-ascii",
        "Content-Disposition": `attachment; filename="${f.fileName}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

import type { NextRequest } from "next/server";
import { z } from "zod";
import { handleApiError } from "@/lib/api/response";
import { guardIntake } from "@/lib/services/document-intake-api";
import { documentIntakeService } from "@/lib/services/document-intake-service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const revalidate = 0;

const idSchema = z.object({ id: z.string().uuid() });

/**
 * Streams the ORIGINAL uploaded document. Auth + scope checked every request.
 * The file lives in ./storage/document-intake/ (never public/); this is the
 * only way to read it — no public URL is ever produced.
 */
export async function GET(_r: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { scope } = await guardIntake("read");
    const { id } = idSchema.parse(await ctx.params);
    const f = await documentIntakeService.fileBuffer(id, scope);
    if (!f) return new Response("Not found", { status: 404 });
    return new Response(f.buffer as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": f.mime,
        "Content-Disposition": `inline; filename="${encodeURIComponent(f.filename)}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

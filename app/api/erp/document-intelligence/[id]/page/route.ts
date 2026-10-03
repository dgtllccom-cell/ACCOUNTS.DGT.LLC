import type { NextRequest } from "next/server";
import { z } from "zod";
import { apiError, handleApiError } from "@/lib/api/response";
import { guardIntake } from "@/lib/services/document-intake-api";
import { documentIntakeService } from "@/lib/services/document-intake-service";
import { apiOk } from "@/lib/api/response";
import { renderPdfPage, pdfPageCount } from "@/lib/document-intelligence/page-render";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const revalidate = 0;

const idSchema = z.object({ id: z.string().uuid() });
const querySchema = z.object({ n: z.coerce.number().int().min(1).max(200).default(1), scale: z.coerce.number().default(2) });

/**
 * One page of the ORIGINAL document as a PNG (PDF pages are rendered once and cached; image uploads are returned
 * as they are). Auth + scope are checked on every request — same rule as the file route.
 */
export async function GET(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { scope } = await guardIntake("read");
    const { id } = idSchema.parse(await ctx.params);
    const q = querySchema.parse({ n: request.nextUrl.searchParams.get("n") ?? undefined, scale: request.nextUrl.searchParams.get("scale") ?? undefined });
    const f = await documentIntakeService.fileBuffer(id, scope);
    if (!f) return apiError("NOT_FOUND", "Document not found in your scope.", 404);
    if (request.nextUrl.searchParams.get("info") === "1") {
      return apiOk({ pages: f.mime === "application/pdf" ? await pdfPageCount(f.buffer) : 1 });
    }
    let body: Buffer;
    let mime = "image/png";
    if (f.mime === "application/pdf") {
      body = await renderPdfPage(id, f.buffer, q.n, q.scale);
    } else {
      body = f.buffer;
      mime = f.mime;
    }
    return new Response(body as unknown as BodyInit, {
      status: 200,
      headers: { "Content-Type": mime, "Cache-Control": "private, max-age=300", "X-Content-Type-Options": "nosniff" },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

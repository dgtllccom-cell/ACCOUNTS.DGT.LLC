import type { NextRequest } from "next/server";
import { z } from "zod";
import { apiOk, apiError, handleApiError } from "@/lib/api/response";
import { guardIntake } from "@/lib/services/document-intake-api";
import { purchaseSalesIntakePreviewService } from "@/lib/services/purchase-sales-intake-preview-service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const revalidate = 0;

const idSchema = z.object({ id: z.string().uuid() });

export async function GET(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { scope } = await guardIntake("read");
    const { id } = idSchema.parse(await ctx.params);
    const sp = request.nextUrl.searchParams;
    const debitAccountId = sp.get("debitAccountId");
    const creditAccountId = sp.get("creditAccountId");
    const data = await purchaseSalesIntakePreviewService.previewFromJob(id, scope, {
      debitAccountId: debitAccountId || null,
      creditAccountId: creditAccountId || null,
    });
    if (!data) return apiError("NOT_FOUND", "Document job not found in your scope.", 404);
    return apiOk(data);
  } catch (error) {
    return handleApiError(error);
  }
}

import type { NextRequest } from "next/server";
import { z } from "zod";
import { apiOk, handleApiError } from "@/lib/api/response";
import { guardUaeTax } from "@/lib/services/uae-tax-api";
import { uaeTaxService } from "@/lib/services/uae-tax-service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { session } = await guardUaeTax("file");
    const { id } = await ctx.params;
    const { ftaReference } = z.object({ ftaReference: z.string().min(1).max(120) }).parse(await request.json());
    const result = await uaeTaxService.fileVatReturn(id, ftaReference, session.userId);
    return apiOk(result);
  } catch (error) {
    return handleApiError(error);
  }
}

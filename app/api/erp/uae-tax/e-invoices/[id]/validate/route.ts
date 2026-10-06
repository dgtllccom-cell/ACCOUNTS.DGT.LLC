import type { NextRequest } from "next/server";
import { apiOk, handleApiError } from "@/lib/api/response";
import { guardUaeTax } from "@/lib/services/uae-tax-api";
import { uaeEInvoiceService } from "@/lib/services/uae-einvoice-service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    await guardUaeTax("write");
    const { id } = await ctx.params;
    const result = await uaeEInvoiceService.validate(id);
    return apiOk(result);
  } catch (error) {
    return handleApiError(error);
  }
}

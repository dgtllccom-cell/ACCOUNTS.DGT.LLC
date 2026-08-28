import type { NextRequest } from "next/server";
import { apiError, apiOk, handleApiError } from "@/lib/api/response";
import { guardUaeTax } from "@/lib/services/uae-tax-api";
import { uaeTaxService } from "@/lib/services/uae-tax-service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    await guardUaeTax("read");
    const { id } = await ctx.params;
    const invoice = await uaeTaxService.getEInvoice(id);
    if (!invoice) return apiError("NOT_FOUND", "e-invoice not found", 404);
    const events = await uaeTaxService.listEInvoiceEvents(id);
    return apiOk({ invoice, events });
  } catch (error) {
    return handleApiError(error);
  }
}

import type { NextRequest } from "next/server";
import { apiOk, handleApiError } from "@/lib/api/response";
import { guardUaeTax } from "@/lib/services/uae-tax-api";
import { uaeEInvoiceService } from "@/lib/services/uae-einvoice-service";
import { uaeTaxService } from "@/lib/services/uae-tax-service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    await guardUaeTax("read");
    const { id } = await ctx.params;
    const result = await uaeEInvoiceService.refreshStatus(id);
    return apiOk(result);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    await guardUaeTax("read");
    const { id } = await ctx.params;
    const invoice = await uaeTaxService.getEInvoice(id);
    const events = await uaeTaxService.listEInvoiceEvents(id);
    return apiOk({ invoice, events });
  } catch (error) {
    return handleApiError(error);
  }
}

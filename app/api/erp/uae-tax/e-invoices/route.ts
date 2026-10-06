import type { NextRequest } from "next/server";
import { z } from "zod";
import { apiOk, handleApiError } from "@/lib/api/response";
import { guardUaeTax } from "@/lib/services/uae-tax-api";
import { uaeTaxService } from "@/lib/services/uae-tax-service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    const { scope } = await guardUaeTax("read");
    const p = new URL(request.url).searchParams;
    const rows = await uaeTaxService.listEInvoices(
      { taxEntityId: p.get("taxEntityId") || undefined, status: p.get("status") || undefined, documentType: p.get("documentType") || undefined },
      scope,
    );
    return apiOk({ rows });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    await guardUaeTax("write");
    const { taxEntityId } = z.object({ taxEntityId: z.string().uuid().optional() }).parse(await request.json().catch(() => ({})));
    const result = await uaeTaxService.buildEInvoiceDrafts(taxEntityId);
    return apiOk(result);
  } catch (error) {
    return handleApiError(error);
  }
}

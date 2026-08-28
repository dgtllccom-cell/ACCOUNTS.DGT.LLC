import type { NextRequest } from "next/server";
import { apiOk, handleApiError } from "@/lib/api/response";
import { guardIntake } from "@/lib/services/document-intake-api";
import { documentIntakeService } from "@/lib/services/document-intake-service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    const { scope } = await guardIntake("read");
    const sp = request.nextUrl.searchParams;
    if (sp.get("view") === "kpis") {
      const kpis = await documentIntakeService.kpis(scope);
      return apiOk({ kpis });
    }
    const rows = await documentIntakeService.list(scope, {
      status: sp.get("status") || undefined,
      domain: sp.get("domain") || undefined,
      docType: sp.get("docType") || undefined,
      search: sp.get("search")?.trim() || undefined,
      limit: sp.get("limit") ? Number(sp.get("limit")) : undefined,
    });
    return apiOk({ rows });
  } catch (error) {
    return handleApiError(error);
  }
}

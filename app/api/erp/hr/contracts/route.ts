import type { NextRequest } from "next/server";
import { apiOk, handleApiError } from "@/lib/api/response";
import { guardContracts } from "@/lib/services/contract-register-api";
import { contractRegisterService } from "@/lib/services/contract-register-service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    const { scope } = await guardContracts("read");
    const p = new URL(request.url).searchParams;
    const { rows, total } = await contractRegisterService.list(
      {
        contractType: p.get("contractType") || undefined,
        sourceModule: p.get("sourceModule") || undefined,
        status: p.get("status") || undefined,
        party: p.get("party") || undefined,
        countryId: p.get("countryId") || undefined,
        countryBranchId: p.get("countryBranchId") || undefined,
        cityBranchId: p.get("cityBranchId") || undefined,
        fromDate: p.get("fromDate") || undefined,
        toDate: p.get("toDate") || undefined,
        search: p.get("search") || undefined,
        limit: p.get("limit") ? Number(p.get("limit")) : undefined,
        offset: p.get("offset") ? Number(p.get("offset")) : undefined,
      },
      scope,
    );
    return apiOk({ rows, total });
  } catch (error) {
    return handleApiError(error);
  }
}

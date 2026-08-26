/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest } from "next/server";
import { apiOk, handleApiError } from "@/lib/api/response";
import { requireErpSession } from "@/lib/auth/session";
import { recalculateCountryInvestmentLedger } from "@/lib/services/super-admin-capital-service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(request: NextRequest) {
  try {
    const session = await requireErpSession(request);
    if (session.role !== "super_admin") {
      throw new Error("Forbidden: Super Admin access required");
    }

    const body = await request.json();
    if (!body.countryId) {
      throw new Error("countryId is required to recalculate investment ledger");
    }

    const result = await recalculateCountryInvestmentLedger(
      body.countryId,
      body.financialPeriodId || null
    );

    return apiOk(result);
  } catch (error) {
    return handleApiError(error);
  }
}

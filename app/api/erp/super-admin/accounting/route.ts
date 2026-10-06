/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest } from "next/server";
import { apiCreated, apiOk, handleApiError } from "@/lib/api/response";
import { requireErpSession } from "@/lib/auth/session";
import {
  createCapitalEntry,
  getSuperAdminCapitalSummary,
} from "@/lib/services/super-admin-capital-service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    const session = await requireErpSession();
    if (!session.isSuperAdmin && !session.roles.includes("super_admin")) {
      throw new Error("Forbidden: Super Admin access required");
    }

    const data = await getSuperAdminCapitalSummary();
    return apiOk(data);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireErpSession();
    if (!session.isSuperAdmin && !session.roles.includes("super_admin")) {
      throw new Error("Forbidden: Super Admin access required");
    }

    const body = await request.json();

    if (!body.accountType || !body.amount) {
      throw new Error("accountType and amount are required");
    }

    const result = await createCapitalEntry({
      session,
      accountType: body.accountType,
      countryId: body.countryId || null,
      description: body.description,
      amount: Number(body.amount),
      currency: body.currency || "USD",
      exchangeRate: Number(body.exchangeRate || 1),
      referenceNo: body.referenceNo,
      narration: body.narration,
      financialPeriodId: body.financialPeriodId,
      debitLedgerId: body.debitLedgerId,
      creditLedgerId: body.creditLedgerId,
    });

    return apiCreated(result);
  } catch (error) {
    return handleApiError(error);
  }
}

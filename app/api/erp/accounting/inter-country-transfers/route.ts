/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest } from "next/server";
import { apiCreated, apiOk, handleApiError } from "@/lib/api/response";
import { requireErpSession } from "@/lib/auth/session";
import {
  createInterCountryTransfer,
  listInterCountryTransfers,
} from "@/lib/services/inter-country-transfer-service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    const session = await requireErpSession(request);
    const { searchParams } = new URL(request.url);

    const countryId = searchParams.get("countryId") || (session.role !== "super_admin" ? session.countryId : null);
    const status = searchParams.get("status");
    const direction = searchParams.get("direction") as "sent" | "received" | null;
    const limit = searchParams.get("limit") ? parseInt(searchParams.get("limit")!, 10) : 50;
    const offset = searchParams.get("offset") ? parseInt(searchParams.get("offset")!, 10) : 0;

    const data = await listInterCountryTransfers({
      countryId,
      status,
      direction,
      limit,
      offset,
    });

    return apiOk(data);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireErpSession(request);
    const body = await request.json();

    if (!body.sourceCountryId || !body.destCountryId || !body.amount || !body.originalCurrency || !body.finalCurrency) {
      throw new Error("Missing required transfer parameters (sourceCountryId, destCountryId, amount, currencies)");
    }

    if (body.sourceCountryId === body.destCountryId) {
      throw new Error("Source and Destination countries must be different for Inter-Country Transfer");
    }

    const result = await createInterCountryTransfer({
      session,
      sourceCountryId: body.sourceCountryId,
      sourceCountryBranchId: body.sourceCountryBranchId,
      sourceCityBranchId: body.sourceCityBranchId,
      sourceBankCashLedgerId: body.sourceBankCashLedgerId,
      sourcePartyLedgerId: body.sourcePartyLedgerId,
      destCountryId: body.destCountryId,
      destCountryBranchId: body.destCountryBranchId,
      destCityBranchId: body.destCityBranchId,
      destBankCashLedgerId: body.destBankCashLedgerId,
      destPartyLedgerId: body.destPartyLedgerId,
      amount: Number(body.amount),
      originalCurrency: body.originalCurrency,
      exchangeRate: Number(body.exchangeRate || 1),
      finalCurrency: body.finalCurrency,
      finalAmount: Number(body.finalAmount || body.amount),
      direction: body.direction === "credit" ? "credit" : "debit",
      narration: body.narration,
      remarks: body.remarks,
      idempotencyKey: body.idempotencyKey,
    });

    return apiCreated(result);
  } catch (error) {
    return handleApiError(error);
  }
}

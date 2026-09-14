/* eslint-disable @typescript-eslint/no-explicit-any */
// Main Transfer & Handover Center — Gmail-style unified inbox across every
// non-financial handover type (shipping stage handoffs, truck tasks, goods
// verification, clearing bills, ...). Financial country-to-country claims
// keep using /api/erp/accounting/inter-country-transfers unchanged; both
// read/write the SAME inter_country_transfers table (see
// supabase/migrations/20261125_transfer_handover_center.sql) so there is one
// engine, not two.
import { NextRequest } from "next/server";
import { z } from "zod";
import { apiCreated, apiOk, handleApiError } from "@/lib/api/response";
import { requireErpSession } from "@/lib/auth/session";
import { authorizeApiScope, authorizeApiScopeEither } from "@/lib/api/scope-middleware";
import { getRequestLanguage } from "@/lib/i18n/server";
import { localizeJoinedNames } from "@/lib/i18n/localize-records";
import {
  createHandoverTransfer,
  listTransferCenterItems,
  type TransferCenterTab,
  type TransferCenterType,
} from "@/lib/services/inter-country-transfer-service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const TABS: TransferCenterTab[] = ["incoming", "sent", "pending", "returned", "accepted", "completed", "all"];
const TYPES: TransferCenterType[] = [
  "financial_claim",
  "shipping_handover",
  "purchase_booking",
  "truck_task",
  "goods_verification",
  "clearing_bill",
  "other",
];

export async function GET(request: NextRequest) {
  try {
    const session = await requireErpSession();
    // List scope is enforced row-by-row inside listTransferCenterItems() (it
    // uses the session's full resolved country/branch/city hierarchy) — this
    // check only gates the permission, not a single record's scope.
    authorizeApiScope(session, { resource: "inter_branch_transfers", action: "read" });

    const { searchParams } = new URL(request.url);
    const tabParam = searchParams.get("tab");
    const tab: TransferCenterTab = (TABS as string[]).includes(tabParam || "") ? (tabParam as TransferCenterTab) : "incoming";
    const typeParam = searchParams.get("type");
    const transferType = (TYPES as string[]).includes(typeParam || "") ? (typeParam as TransferCenterType) : (typeParam === "all" ? "all" : null);
    const limit = searchParams.get("limit") ? parseInt(searchParams.get("limit")!, 10) : 50;
    const offset = searchParams.get("offset") ? parseInt(searchParams.get("offset")!, 10) : 0;

    const data = await listTransferCenterItems({ session, tab, transferType, limit, offset });

    if (Array.isArray(data.transfers) && data.transfers.length > 0) {
      const lang = await getRequestLanguage(searchParams.get("lang"));
      data.transfers = await localizeJoinedNames<any>(data.transfers, lang, [
        { idField: "source_country_id", nameField: "source_country_name", table: "countries" },
        { idField: "dest_country_id", nameField: "dest_country_name", table: "countries" },
        { idField: "sender_user_id", nameField: "sender_name", table: "profiles", field: "full_name" },
        { idField: "receiver_user_id", nameField: "receiver_name", table: "profiles", field: "full_name" },
      ]);
    }

    return apiOk(data);
  } catch (error) {
    return handleApiError(error);
  }
}

const createSchema = z.object({
  transferType: z.enum(["shipping_handover", "purchase_booking", "truck_task", "goods_verification", "clearing_bill", "other"]),
  sourceCountryId: z.string().uuid(),
  sourceCountryBranchId: z.string().uuid().nullish(),
  sourceCityBranchId: z.string().uuid().nullish(),
  destCountryId: z.string().uuid(),
  destCountryBranchId: z.string().uuid().nullish(),
  destCityBranchId: z.string().uuid().nullish(),
  receiverUserId: z.string().uuid().nullish(),
  sourceTable: z.string().trim().max(64).nullish(),
  sourceId: z.string().uuid().nullish(),
  narration: z.string().trim().max(2000).nullish(),
  remarks: z.string().trim().max(2000).nullish(),
  billNumber: z.string().trim().max(120).nullish(),
  containerNumber: z.string().trim().max(120).nullish(),
  orderReference: z.string().trim().max(120).nullish(),
  blNumber: z.string().trim().max(120).nullish(),
  jobNumber: z.string().trim().max(120).nullish(),
  customerPartyName: z.string().trim().max(200).nullish(),
  referenceDate: z.string().trim().max(20).nullish(),
  claimDescription: z.string().trim().max(2000).nullish(),
  metadata: z.record(z.string(), z.unknown()).nullish(),
});

export async function POST(request: NextRequest) {
  try {
    const session = await requireErpSession();
    const body = createSchema.parse(await request.json());

    const isSameBranch =
      body.sourceCountryId === body.destCountryId &&
      (body.sourceCountryBranchId || null) === (body.destCountryBranchId || null) &&
      (body.sourceCityBranchId || null) === (body.destCityBranchId || null);

    if (isSameBranch && !body.receiverUserId) {
      throw new Error("Source and destination must differ unless a specific receiver user is assigned for task handover.");
    }

    authorizeApiScopeEither(session, {
      resource: "inter_branch_transfers",
      action: "create",
      source: { countryId: body.sourceCountryId, countryBranchId: body.sourceCountryBranchId ?? undefined, cityBranchId: body.sourceCityBranchId ?? undefined },
      destination: { countryId: body.destCountryId, countryBranchId: body.destCountryBranchId ?? undefined, cityBranchId: body.destCityBranchId ?? undefined },
    });

    const result = await createHandoverTransfer({
      session,
      transferType: body.transferType,
      sourceCountryId: body.sourceCountryId,
      sourceCountryBranchId: body.sourceCountryBranchId ?? null,
      sourceCityBranchId: body.sourceCityBranchId ?? null,
      destCountryId: body.destCountryId,
      destCountryBranchId: body.destCountryBranchId ?? null,
      destCityBranchId: body.destCityBranchId ?? null,
      receiverUserId: body.receiverUserId ?? null,
      sourceTable: body.sourceTable ?? null,
      sourceId: body.sourceId ?? null,
      narration: body.narration ?? null,
      remarks: body.remarks ?? null,
      billNumber: body.billNumber ?? null,
      containerNumber: body.containerNumber ?? null,
      orderReference: body.orderReference ?? null,
      blNumber: body.blNumber ?? null,
      jobNumber: body.jobNumber ?? null,
      customerPartyName: body.customerPartyName ?? null,
      referenceDate: body.referenceDate ?? null,
      claimDescription: body.claimDescription ?? null,
      metadata: (body.metadata as Record<string, unknown> | null) ?? null,
    });

    return apiCreated(result);
  } catch (error) {
    return handleApiError(error);
  }
}

import { NextRequest } from "next/server";
import { z } from "zod";
import { apiCreated, apiError, apiOk, handleApiError } from "@/lib/api/response";
import { auditApiAction } from "@/lib/api/audit";
import { requireErpSession, ErpAuthError } from "@/lib/auth/session";
import { getRequestLanguage } from "@/lib/i18n/server";
import { createTempBill, listTempBills, tempBillSummary, mapTempBillError } from "@/lib/temp-bills/service";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const session = await requireErpSession();
    const p = request.nextUrl.searchParams;
    const lang = await getRequestLanguage(p.get("lang"));
    const [{ rows }, summary] = await Promise.all([
      listTempBills(session, {
        kind: p.get("kind"),
        q: p.get("q"),
        partyId: p.get("partyId"),
        referenceNo: p.get("referenceNo"),
        fromDate: p.get("fromDate"),
        toDate: p.get("toDate"),
        lang,
        limit: p.get("limit") ? Number(p.get("limit")) : undefined,
      }),
      tempBillSummary(session),
    ]);
    return apiOk({ rows, summary, lang });
  } catch (error) {
    if (error instanceof ErpAuthError) return handleApiError(error);
    const m = mapTempBillError(error);
    if (m.setupPending) return apiOk({ rows: [], summary: {}, setupPending: true });
    return apiError(m.code, m.message, m.status);
  }
}

const createSchema = z.object({
  billKind: z.enum(["purchase", "sale"]),
  partyAccountId: z.string().uuid().optional().nullable(),
  partyCustomerId: z.string().uuid().optional().nullable(),
  partyName: z.string().trim().min(1).max(240),
  referenceNo: z.string().trim().max(120).optional().nullable(),
  goodsId: z.string().uuid().optional().nullable(),
  goodsName: z.string().trim().max(240).optional().nullable(),
  billNo: z.string().trim().max(120).optional().nullable(),
  containerNo: z.string().trim().max(120).optional().nullable(),
  blNo: z.string().trim().max(120).optional().nullable(),
  billDate: z.string().trim().max(40).optional().nullable(),
  quantity: z.union([z.number(), z.string().trim()]).optional().nullable(),
  weightCartons: z.union([z.number(), z.string().trim()]).optional().nullable(),
  unit: z.string().trim().max(40).optional().nullable(),
  rate: z.union([z.number(), z.string().trim()]).optional().nullable(),
  amount: z.union([z.number(), z.string().trim()]).optional().nullable(),
  currencyCode: z.string().trim().max(8).optional().nullable(),
  remarks: z.string().trim().max(4000).optional().nullable(),
  countryId: z.string().uuid().optional().nullable(),
  countryBranchId: z.string().uuid().optional().nullable(),
  cityBranchId: z.string().uuid().optional().nullable(),
});

export async function POST(request: NextRequest) {
  try {
    const session = await requireErpSession();
    const lang = await getRequestLanguage(request.nextUrl.searchParams.get("lang"));
    const body = createSchema.parse(await request.json());
    const { id, entryNo } = await createTempBill(
      session,
      {
        ...body,
        quantity: body.quantity == null ? null : Number(body.quantity),
        weightCartons: body.weightCartons == null ? null : Number(body.weightCartons),
        rate: body.rate == null ? null : Number(body.rate),
        amount: body.amount == null ? null : Number(body.amount),
      },
      lang,
    );
    await auditApiAction(request, {
      action: "temp_bill.create.api",
      entityTable: "temp_bill",
      entityId: id,
      after: { billKind: body.billKind, partyName: body.partyName, billNo: body.billNo ?? null, amount: body.amount ?? null },
    });
    return apiCreated({ id, entryNo });
  } catch (error) {
    if (error instanceof ErpAuthError) return handleApiError(error);
    if (error instanceof z.ZodError) return apiError("BAD_REQUEST", error.issues.map((i) => i.message).join("; "), 400);
    const m = mapTempBillError(error);
    return apiError(m.code, m.message, m.status);
  }
}

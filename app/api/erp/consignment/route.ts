import { NextRequest } from "next/server";
import { z } from "zod";
import { apiCreated, apiError, apiOk } from "@/lib/api/response";
import { auditApiAction } from "@/lib/api/audit";
import { getRequestLanguage } from "@/lib/i18n/server";
import { requireConsignmentSession, consignmentErrorResponse } from "@/lib/consignment/route-helpers";
import { createConsignment, listConsignments, consignmentSummary } from "@/lib/consignment/service";
import { CONSIGNMENT_STATUSES } from "@/lib/consignment/types";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireConsignmentSession();
  if ("response" in auth) return auth.response;
  try {
    const p = request.nextUrl.searchParams;
    const lang = await getRequestLanguage(p.get("lang"));
    const [rows, summary] = await Promise.all([
      listConsignments(auth.session, {
        q: p.get("q"),
        status: p.get("status"),
        lang,
        limit: p.get("limit") ? Number(p.get("limit")) : undefined,
      }),
      consignmentSummary(auth.session),
    ]);
    return apiOk({ rows, summary, lang });
  } catch (error) {
    return consignmentErrorResponse(error, { rows: [], summary: {} });
  }
}

const createSchema = z.object({
  partyAccountId: z.string().uuid().optional().nullable(),
  partyCustomerId: z.string().uuid().optional().nullable(),
  partyName: z.string().trim().min(1).max(240),
  partyContact: z.string().trim().max(240).optional().nullable(),
  partyPhone: z.string().trim().max(60).optional().nullable(),
  title: z.string().trim().max(240).optional().nullable(),
  referenceNo: z.string().trim().max(120).optional().nullable(),
  baseCurrency: z.string().trim().max(8).optional().nullable(),
  consignmentDate: z.string().trim().max(40).optional().nullable(),
  countryId: z.string().uuid().optional().nullable(),
  countryBranchId: z.string().uuid().optional().nullable(),
  cityBranchId: z.string().uuid().optional().nullable(),
  notes: z.string().trim().max(4000).optional().nullable(),
  originalLanguage: z.enum(["en", "ur", "ps", "fa", "ar"]).optional(),
  status: z.enum(CONSIGNMENT_STATUSES).optional(),
});

export async function POST(request: NextRequest) {
  const auth = await requireConsignmentSession();
  if ("response" in auth) return auth.response;
  try {
    const parsed = createSchema.safeParse(await request.json());
    if (!parsed.success) return apiError("VALIDATION", "Invalid consignment", 400, parsed.error.flatten());
    const { id, consignmentNo } = await createConsignment(auth.session, parsed.data);
    try {
      await auditApiAction(request, {
        action: "consignment.create",
        entityTable: "consignment",
        entityId: id,
        after: { consignmentNo, partyName: parsed.data.partyName },
      });
    } catch {}
    return apiCreated({ id, consignmentNo });
  } catch (error) {
    return consignmentErrorResponse(error);
  }
}

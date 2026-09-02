import { NextRequest } from "next/server";
import { z } from "zod";
import { apiError, apiOk } from "@/lib/api/response";
import { auditApiAction } from "@/lib/api/audit";
import { getRequestLanguage } from "@/lib/i18n/server";
import { requireConsignmentSession, consignmentErrorResponse } from "@/lib/consignment/route-helpers";
import { getConsignmentReport, updateConsignment, deleteConsignment } from "@/lib/consignment/service";
import { CONSIGNMENT_STATUSES } from "@/lib/consignment/types";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireConsignmentSession();
  if ("response" in auth) return auth.response;
  try {
    const { id } = await params;
    const lang = await getRequestLanguage(request.nextUrl.searchParams.get("lang"));
    const report = await getConsignmentReport(auth.session, id, lang);
    return apiOk({ report, lang });
  } catch (error) {
    return consignmentErrorResponse(error);
  }
}

const patchSchema = z.object({
  partyName: z.string().trim().min(1).max(240).optional(),
  partyAccountId: z.string().uuid().nullable().optional(),
  partyCustomerId: z.string().uuid().nullable().optional(),
  partyContact: z.string().trim().max(240).nullable().optional(),
  partyPhone: z.string().trim().max(60).nullable().optional(),
  title: z.string().trim().max(240).nullable().optional(),
  referenceNo: z.string().trim().max(120).nullable().optional(),
  baseCurrency: z.string().trim().max(8).nullable().optional(),
  consignmentDate: z.string().trim().max(40).nullable().optional(),
  notes: z.string().trim().max(4000).nullable().optional(),
  status: z.enum(CONSIGNMENT_STATUSES).optional(),
});

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireConsignmentSession();
  if ("response" in auth) return auth.response;
  try {
    const { id } = await params;
    const parsed = patchSchema.safeParse(await request.json());
    if (!parsed.success) return apiError("VALIDATION", "Invalid update", 400, parsed.error.flatten());
    await updateConsignment(auth.session, id, parsed.data);
    try {
      await auditApiAction(request, { action: "consignment.update", entityTable: "consignment", entityId: id, after: parsed.data });
    } catch {}
    return apiOk({ id });
  } catch (error) {
    return consignmentErrorResponse(error);
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireConsignmentSession();
  if ("response" in auth) return auth.response;
  try {
    const { id } = await params;
    await deleteConsignment(auth.session, id);
    try {
      await auditApiAction(request, { action: "consignment.delete", entityTable: "consignment", entityId: id });
    } catch {}
    return apiOk({ id });
  } catch (error) {
    return consignmentErrorResponse(error);
  }
}

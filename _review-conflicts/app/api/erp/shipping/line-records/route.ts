import { NextRequest } from "next/server";
import { z } from "zod";
import { apiCreated, apiOk, handleApiError } from "@/lib/api/response";
import { optionalUuidSchema } from "@/lib/api/erp-validation";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import { createApiSupabaseClient, requireSupabaseData, writeAuditLog } from "@/lib/api/supabase";
import { requireErpSession } from "@/lib/auth/session";

const shippingLineSchema = z.object({
  countryId: optionalUuidSchema,
  countryBranchId: optionalUuidSchema,
  cityBranchId: optionalUuidSchema,
  purchaseOrderId: optionalUuidSchema,
  salesOrderId: optionalUuidSchema,
  accountId: optionalUuidSchema,
  ledgerId: optionalUuidSchema,
  shippingLineName: z.string().trim().min(1).max(200),
  vesselName: z.string().trim().max(200).optional().nullable(),
  voyageNumber: z.string().trim().max(120).optional().nullable(),
  shippingReferenceNo: z.string().trim().max(120).optional().nullable(),
  containerNumbers: z.array(z.string().trim().max(120)).optional(),
  portOfLoading: z.string().trim().max(200).optional().nullable(),
  portOfDischarge: z.string().trim().max(200).optional().nullable(),
  eta: z.string().date().optional().nullable(),
  etd: z.string().date().optional().nullable(),
  shipmentStatus: z.string().trim().max(80).default("draft"),
  accountNumber: z.string().trim().max(120).optional().nullable(),
  manualReferenceNumber: z.string().trim().max(120).optional().nullable(),
  customerNumber: z.string().trim().max(120).optional().nullable(),
  countrySerialNumber: z.string().trim().max(120).optional().nullable(),
  branchSerialNumber: z.string().trim().max(120).optional().nullable(),
  workflowState: z.unknown().optional(),
  formData: z.unknown().optional()
});

export async function GET(request: NextRequest) {
  try {
    const session = await requireErpSession();
    const params = request.nextUrl.searchParams;
    const countryId = params.get("countryId");
    const countryBranchId = params.get("countryBranchId");
    const cityBranchId = params.get("cityBranchId");

    authorizeApiScope(session, { resource: "shipping", action: "read", countryId, countryBranchId, cityBranchId });

    const supabase = await createApiSupabaseClient();
    let query: any = supabase
      .from("shipping_line_records")
      .select("*")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(Math.min(Number(params.get("limit") || 100), 200));

    if (params.get("q")) {
      const term = String(params.get("q")).replace(/[%_]/g, "");
      query = query.or(`shipping_line_name.ilike."%${term}%",vessel_name.ilike."%${term}%",voyage_number.ilike."%${term}%",shipping_reference_no.ilike."%${term}%",account_number.ilike."%${term}%",manual_reference_number.ilike."%${term}%"`);
    }
    if (countryId) query = query.eq("country_id", countryId);
    else if (!session.isSuperAdmin) query = query.in("country_id", session.countryIds.length ? session.countryIds : ["00000000-0000-0000-0000-000000000000"]);
    if (countryBranchId) query = query.eq("country_branch_id", countryBranchId);
    else if (!session.isSuperAdmin && session.countryBranchIds.length) query = query.in("country_branch_id", session.countryBranchIds);
    if (cityBranchId) query = query.eq("city_branch_id", cityBranchId);
    else if (!session.isSuperAdmin && session.cityBranchIds.length) query = query.in("city_branch_id", session.cityBranchIds);

    return apiOk({ shippingLineRecords: await requireSupabaseData(query) });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireErpSession();
    const body = shippingLineSchema.parse(await request.json());

    authorizeApiScope(session, {
      resource: "shipping",
      action: "create",
      countryId: body.countryId ?? null,
      countryBranchId: body.countryBranchId ?? null,
      cityBranchId: body.cityBranchId ?? null
    });

    const payload = {
      country_id: body.countryId ?? null,
      country_branch_id: body.countryBranchId ?? null,
      city_branch_id: body.cityBranchId ?? null,
      purchase_order_id: body.purchaseOrderId ?? null,
      sales_order_id: body.salesOrderId ?? null,
      account_id: body.accountId ?? null,
      ledger_id: body.ledgerId ?? null,
      shipping_line_name: body.shippingLineName,
      vessel_name: body.vesselName ?? null,
      voyage_number: body.voyageNumber ?? null,
      shipping_reference_no: body.shippingReferenceNo ?? null,
      container_numbers: body.containerNumbers ?? [],
      port_of_loading: body.portOfLoading ?? null,
      port_of_discharge: body.portOfDischarge ?? null,
      eta: body.eta ?? null,
      etd: body.etd ?? null,
      shipment_status: body.shipmentStatus,
      account_number: body.accountNumber ?? null,
      manual_reference_number: body.manualReferenceNumber ?? null,
      customer_number: body.customerNumber ?? null,
      country_serial_number: body.countrySerialNumber ?? null,
      branch_serial_number: body.branchSerialNumber ?? null,
      workflow_state: body.workflowState ?? {},
      form_data: body.formData ?? {},
      created_by: null,
      updated_by: null
    };

    const supabase = await createApiSupabaseClient();
    const row = await requireSupabaseData(supabase.from("shipping_line_records").insert(payload).select("id").single());

    await writeAuditLog({
      action: "create",
      entityTable: "shipping_line_records",
      entityId: (row as any).id,
      before: null,
      after: payload,
      ipAddress: request.headers.get("x-forwarded-for") ?? null
    });

    return apiCreated({ shippingLineRecordId: (row as any).id });
  } catch (error) {
    return handleApiError(error);
  }
}

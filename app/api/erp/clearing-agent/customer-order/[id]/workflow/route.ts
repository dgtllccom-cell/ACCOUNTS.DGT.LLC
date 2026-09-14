/* eslint-disable @typescript-eslint/no-explicit-any */
// Phase 2 read model: one order + its legs + goods verifications, for the
// Shipping/Clearing pipeline workflow screen. Reuses the existing
// getCustomerOrderById() (same order/legs identity throughout — no second
// order record).
export const dynamic = "force-dynamic";

import type { NextRequest } from "next/server";
import { apiOk, handleApiError, ApiClientError } from "@/lib/api/response";
import { requireErpSession } from "@/lib/auth/session";
import { getCustomerOrderById } from "@/lib/services/clearing-customer-order-service";
import { withLocalPg } from "@/lib/db/local-postgres";
import { getRequestLanguage } from "@/lib/i18n/server";
import { localizeRecordFields } from "@/lib/i18n/localize-records";

export async function GET(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireErpSession();
    const { id } = await ctx.params;
    const lang = await getRequestLanguage(request.nextUrl.searchParams.get("lang"));

    const order = await getCustomerOrderById(id);
    if (!order) throw new ApiClientError("Order not found.", { status: 404 });

    if (!session.isSuperAdmin) {
      const inScope =
        ((order as any).city_branch_id && (session.cityBranchIds ?? []).includes((order as any).city_branch_id)) ||
        ((order as any).country_branch_id && (session.countryBranchIds ?? []).includes((order as any).country_branch_id)) ||
        ((order as any).country_id && (session.countryIds ?? []).includes((order as any).country_id));
      if (!inScope) throw new ApiClientError("This order is outside your scope.", { status: 403 });
    }

    const [verifications, transfers] = await Promise.all([
      withLocalPg(async (sql) => {
        const rows = (await sql`
          select v.*, p.full_name as verified_by_name
          from public.clearing_customer_order_goods_verifications v
          left join public.profiles p on p.id = v.verified_by
          where v.order_id = ${id}::uuid and v.deleted_at is null
          order by v.created_at desc
        `) as unknown as any[];
        return rows;
      }),
      withLocalPg(async (sql) => {
        const legIds = ((order as any).legs || []).map((l: any) => l.id);
        if (!legIds.length) return [];
        const rows = (await sql`
          select t.id, t.transfer_no, t.transfer_type, t.status, t.source_id, t.dest_country_id, t.dest_country_branch_id,
                 t.dest_city_branch_id, t.created_at, t.accepted_at, t.completed_at, t.return_reason, t.rejection_reason,
                 t.narration, t.remarks, t.metadata, t.sender_user_id, t.receiver_user_id,
                 sp.full_name as sender_name, rp.full_name as receiver_name
          from public.inter_country_transfers t
          left join public.profiles sp on sp.id = t.sender_user_id
          left join public.profiles rp on rp.id = t.receiver_user_id
          where (
            (t.source_table = 'clearing_customer_order_legs' and t.source_id = any(${legIds}::uuid[]))
            or (t.source_table = 'clearing_customer_orders' and t.source_id = ${id}::uuid)
            or t.order_reference = ${(order as any).order_no}
          ) and t.deleted_at is null
          order by t.created_at desc
        `) as unknown as any[];
        return rows;
      }),
    ]);

    let localizedOrder: any = order;
    try {
      const [loc] = await localizeRecordFields<any>(
        [order as any],
        "clearing_customer_orders",
        ["customer_name", "route_name", "cargo_details", "remarks", "goods_name", "exporter_name", "importer_name", "buyer_name", "notify_party_name"],
        lang
      );
      localizedOrder = loc ?? order;
    } catch {
      // keep the original record if localization is unavailable
    }

    return apiOk({ order: localizedOrder, verifications, transfers });
  } catch (error) {
    return handleApiError(error);
  }
}

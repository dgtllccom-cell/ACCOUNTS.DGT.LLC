import { NextRequest, NextResponse } from "next/server";
import { requireErpSession } from "@/lib/auth/session";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import { rethrowIfNextControlFlow } from "@/lib/api/response";
import {
  getCustomerOrderById,
  listCustomerOrders,
  saveCustomerOrder,
  type CustomerOrderScopeFilter
} from "@/lib/services/clearing-customer-order-service";

// Shipping Customer Orders carry real commercial/customs data scoped to a country,
// branch and (for shipping-scoped logins) a clearing agent — this must never be
// readable/writable by every authenticated user regardless of role, the same
// standard already applied to /api/erp/handovers.
function scopeOf(session: any): CustomerOrderScopeFilter {
  const isSuperAdmin = !!session.isSuperAdmin || (session.roles ?? []).includes("super_admin_reports");
  return {
    isSuperAdmin,
    countryIds: isSuperAdmin ? null : (session.countryIds ?? []),
    countryBranchIds: isSuperAdmin ? null : (session.countryBranchIds ?? []),
    cityBranchIds: isSuperAdmin ? null : (session.cityBranchIds ?? []),
    clearingAgentIds: isSuperAdmin ? null : (session.clearingAgentIds ?? []),
    createdByUserId: session.userId ?? null
  };
}

export async function GET(req: NextRequest) {
  try {
    const session = await requireErpSession();
    authorizeApiScope(session, { resource: "shipping_records", action: "read" });
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const orderId = searchParams.get("id");
    const scope = scopeOf(session);

    if (orderId) {
      const order = await getCustomerOrderById(orderId);
      if (!order) {
        return NextResponse.json({ success: false, error: "Customer order not found" }, { status: 404 });
      }
      if (!scope.isSuperAdmin) {
        const inScope =
          (scope.clearingAgentIds && scope.clearingAgentIds.length > 0 && scope.clearingAgentIds.includes(order.clearing_agent_id)) ||
          (scope.cityBranchIds && scope.cityBranchIds.length > 0 && scope.cityBranchIds.includes(order.city_branch_id)) ||
          (scope.countryBranchIds && scope.countryBranchIds.length > 0 && scope.countryBranchIds.includes(order.country_branch_id)) ||
          (scope.countryIds && scope.countryIds.length > 0 && scope.countryIds.includes(order.country_id)) ||
          (order.created_by && order.created_by === scope.createdByUserId);
        if (!inScope) {
          return NextResponse.json({ success: false, error: "Not authorized to view this order" }, { status: 403 });
        }
      }
      return NextResponse.json({ success: true, data: order });
    }

    const data = await listCustomerOrders(status, scope);
    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    rethrowIfNextControlFlow(error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireErpSession();
    authorizeApiScope(session, { resource: "shipping_records", action: "create" });
    const body = await req.json();
    const isSuperAdmin = !!session.isSuperAdmin;

    // Scope is derived from the session, never trusted from the request body —
    // a non-super-admin cannot create an order tagged to a country/branch they
    // don't belong to.
    const sessionCountryId = (session.countryIds ?? [])[0] ?? null;
    const sessionCountryBranchId = (session.countryBranchIds ?? [])[0] ?? null;
    const sessionCityBranchId = (session.cityBranchIds ?? [])[0] ?? null;
    const sessionClearingAgentId = (session.clearingAgentIds ?? [])[0] ?? null;

    const result = await saveCustomerOrder({
      customerId: body.customer_id ?? body.customerId ?? null,
      customerName: body.customer_name ?? body.customerName ?? body.supplier_name ?? body.supplierName ?? "",
      goodsId: body.goods_id ?? body.goodsId ?? null,
      goodsVariationId: body.goods_variation_id ?? body.goodsVariationId ?? null,
      goodsName: body.goods_name ?? body.goodsName ?? null,
      goodsChsCode: body.goods_chs_code ?? body.goodsChsCode ?? null,
      goodsVariationLabel: body.goods_variation_label ?? body.goodsVariationLabel ?? null,
      goodsBrand: body.goods_brand ?? body.goodsBrand ?? null,
      goodsSize: body.goods_size ?? body.goodsSize ?? null,
      goodsOriginCountryName: body.goods_origin_country_name ?? body.goodsOriginCountryName ?? null,
      routeName: body.route_name ?? body.routeName ?? null,
      shipmentType: body.shipment_type ?? body.shipmentType ?? "FCL",
      transportMode: body.transport_mode ?? body.transportMode ?? "by_sea",
      movementType: body.movement_type ?? body.movementType ?? "import",
      exporterName: body.exporter_name ?? body.exporterName ?? null,
      importerName: body.importer_name ?? body.importerName ?? null,
      notifyPartyRequired: body.notify_party_required ?? body.notifyPartyRequired ?? false,
      notifyPartyName: body.notify_party_name ?? body.notifyPartyName ?? null,
      buyerName: body.buyer_name ?? body.buyerName ?? null,
      loadingSource: body.loading_source ?? body.loadingSource ?? null,
      loadingSourceName: body.loading_source_name ?? body.loadingSourceName ?? null,
      loadingCountryId: body.loading_country_id ?? body.loadingCountryId ?? null,
      loadingCountryName: body.loading_country_name ?? body.loadingCountryName ?? null,
      receivingCountryId: body.receiving_country_id ?? body.receivingCountryId ?? null,
      receivingCountryName: body.receiving_country_name ?? body.receivingCountryName ?? null,
      loadingPortId: body.loading_port_id ?? body.loadingPortId ?? null,
      loadingPortName: body.loading_port_name ?? body.loadingPortName ?? null,
      destinationPortId: body.destination_port_id ?? body.destinationPortId ?? null,
      destinationPortName: body.destination_port_name ?? body.destinationPortName ?? null,
      cargoDetails: body.cargo_details ?? body.cargoDetails ?? null,
      expectedLoadingDate: body.expected_loading_date ?? body.expectedLoadingDate ?? null,
      remarks: body.remarks ?? null,
      status: body.status ?? "pending",
      orderNo: body.order_no ?? body.orderNo ?? null,
      partyLinks: body.party_links ?? body.partyLinks ?? undefined,
      legs: body.legs ?? undefined,
      originalLanguage: body.original_language ?? body.originalLanguage ?? "en",
      countryId: isSuperAdmin ? (body.country_id ?? body.countryId ?? null) : sessionCountryId,
      countryBranchId: isSuperAdmin ? (body.country_branch_id ?? body.countryBranchId ?? null) : sessionCountryBranchId,
      cityBranchId: isSuperAdmin ? (body.city_branch_id ?? body.cityBranchId ?? null) : sessionCityBranchId,
      clearingAgentId: isSuperAdmin ? (body.clearing_agent_id ?? body.clearingAgentId ?? null) : sessionClearingAgentId,
      createdBy: session.userId ?? null,
      truckId: body.truck_id ?? body.truckId ?? null,
      truckRegistrationType: body.truck_registration_type ?? body.truckRegistrationType ?? null,
      truckNumber: body.truck_number ?? body.truckNumber ?? null,
      truckDriverName: body.truck_driver_name ?? body.truckDriverName ?? null,
      truckDriverMobile: body.truck_driver_mobile ?? body.truckDriverMobile ?? null,
      truckOwnerName: body.truck_owner_name ?? body.truckOwnerName ?? null,
      truckTransportCompany: body.truck_transport_company ?? body.truckTransportCompany ?? null,
      truckDetails: body.truck_details ?? body.truckDetails ?? null,
      loadType: body.load_type ?? body.loadType ?? null,
      loadingStateProvinceId: body.loading_state_province_id ?? body.loadingStateProvinceId ?? null,
      loadingDistrictId: body.loading_district_id ?? body.loadingDistrictId ?? null,
      loadingCityId: body.loading_city_id ?? body.loadingCityId ?? null,
      loadingAreaId: body.loading_area_id ?? body.loadingAreaId ?? null,
      receivingStateProvinceId: body.receiving_state_province_id ?? body.receivingStateProvinceId ?? null,
      receivingDistrictId: body.receiving_district_id ?? body.receivingDistrictId ?? null,
      receivingCityId: body.receiving_city_id ?? body.receivingCityId ?? null,
      receivingAreaId: body.receiving_area_id ?? body.receivingAreaId ?? null,
      loadingSourceWarehouseId: body.loading_source_warehouse_id ?? body.loadingSourceWarehouseId ?? null,
      loadingSourceContainerRef: body.loading_source_container_ref ?? body.loadingSourceContainerRef ?? null,
      goodsQuantity: body.goods_quantity ?? body.goodsQuantity ?? null,
      goodsUnit: body.goods_unit ?? body.goodsUnit ?? null,
      goodsBagsCartons: body.goods_bags_cartons ?? body.goodsBagsCartons ?? null,
      goodsGrossWeight: body.goods_gross_weight ?? body.goodsGrossWeight ?? null,
      goodsEmptyWeight: body.goods_empty_weight ?? body.goodsEmptyWeight ?? null,
      goodsNetWeight: body.goods_net_weight ?? body.goodsNetWeight ?? null
    });

    return NextResponse.json({ success: true, data: result.order, party_links: result.partyLinks, legs: result.legs });
  } catch (error: any) {
    rethrowIfNextControlFlow(error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

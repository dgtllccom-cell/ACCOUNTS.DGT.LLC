import { NextRequest, NextResponse } from "next/server";
import { requireErpSession } from "@/lib/auth/session";
import { rethrowIfNextControlFlow } from "@/lib/api/response";
import {
  getCustomerOrderById,
  listCustomerOrders,
  saveCustomerOrder
} from "@/lib/services/clearing-customer-order-service";

export async function GET(req: NextRequest) {
  try {
    await requireErpSession();
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const orderId = searchParams.get("id");

    if (orderId) {
      const order = await getCustomerOrderById(orderId);
      if (!order) {
        return NextResponse.json({ success: false, error: "Customer order not found" }, { status: 404 });
      }
      return NextResponse.json({ success: true, data: order });
    }

    const data = await listCustomerOrders(status);
    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    rethrowIfNextControlFlow(error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireErpSession();
    const body = await req.json();
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
      originalLanguage: body.original_language ?? body.originalLanguage ?? "en",
      countryId: body.country_id ?? body.countryId ?? null,
      countryBranchId: body.country_branch_id ?? body.countryBranchId ?? null,
      cityBranchId: body.city_branch_id ?? body.cityBranchId ?? null,
      truckId: body.truck_id ?? body.truckId ?? null,
      truckRegistrationType: body.truck_registration_type ?? body.truckRegistrationType ?? null,
      truckNumber: body.truck_number ?? body.truckNumber ?? null,
      truckDriverName: body.truck_driver_name ?? body.truckDriverName ?? null,
      truckDriverMobile: body.truck_driver_mobile ?? body.truckDriverMobile ?? null,
      truckOwnerName: body.truck_owner_name ?? body.truckOwnerName ?? null,
      truckTransportCompany: body.truck_transport_company ?? body.truckTransportCompany ?? null,
      truckDetails: body.truck_details ?? body.truckDetails ?? null
    });

    return NextResponse.json({ success: true, data: result.order, party_links: result.partyLinks });
  } catch (error: any) {
    rethrowIfNextControlFlow(error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

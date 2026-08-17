import { NextRequest, NextResponse } from "next/server";
import {
  deleteCustomerOrder,
  getCustomerOrderById,
  saveCustomerOrder
} from "@/lib/services/clearing-customer-order-service";

async function resolveOrderId(req: NextRequest, params: Promise<{ id: string }> | { id: string }) {
  try {
    const resolved = await Promise.resolve(params as any);
    const id = typeof resolved?.id === "string" ? resolved.id.trim() : "";
    if (id) return id;
  } catch {
    // fall back to the path segment below
  }

  const parts = new URL(req.url).pathname.split("/").filter(Boolean);
  return parts[parts.length - 1] || "";
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> | { id: string } }) {
  try {
    const id = await resolveOrderId(req, params);
    if (!id) {
      return NextResponse.json({ success: false, error: "Customer order id is required" }, { status: 400 });
    }
    const order = await getCustomerOrderById(id);
    if (!order) {
      return NextResponse.json({ success: false, error: "Customer order not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true, data: order });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> | { id: string } }) {
  try {
    const id = await resolveOrderId(req, params);
    if (!id) {
      return NextResponse.json({ success: false, error: "Customer order id is required" }, { status: 400 });
    }
    const body = await req.json();
    const result = await saveCustomerOrder({
      id,
      customerId: body.customer_id ?? body.customerId ?? null,
      customerName: body.customer_name ?? body.customerName ?? body.supplier_name ?? body.supplierName ?? "",
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
      partyLinks: body.party_links ?? body.partyLinks ?? undefined,
      originalLanguage: body.original_language ?? body.originalLanguage ?? "en",
      countryId: body.country_id ?? body.countryId ?? null,
      countryBranchId: body.country_branch_id ?? body.countryBranchId ?? null,
      cityBranchId: body.city_branch_id ?? body.cityBranchId ?? null
    });

    return NextResponse.json({ success: true, data: result.order, party_links: result.partyLinks });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> | { id: string } }) {
  try {
    const id = await resolveOrderId(req, params);
    if (!id) {
      return NextResponse.json({ success: false, error: "Customer order id is required" }, { status: 400 });
    }
    const deleted = await deleteCustomerOrder(id);
    return NextResponse.json({ success: true, data: deleted });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

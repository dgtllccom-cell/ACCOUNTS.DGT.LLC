import { withLocalPg } from "@/lib/db/local-postgres";
import { syncRecordTranslations } from "@/lib/i18n/record-translation-sync";
import type { SupportedLanguage } from "@/lib/i18n/languages";

export type PartyRoleKey = "supplier" | "importer" | "exporter" | "notify_party" | "buyer";

export type PartyLinkInput = {
  roleKey: PartyRoleKey;
  partyCustomerId?: string | null;
  partyCustomerName?: string | null;
  partyCompanyId?: string | null;
  partyCompanyName?: string | null;
  selectedAddressText?: string | null;
  selectedAddressSource?: string | null;
};

export type ClearingCustomerOrderInput = {
  id?: string | null;
  customerId?: string | null;
  customerName: string;
  goodsId?: string | null;
  goodsVariationId?: string | null;
  goodsName?: string | null;
  goodsChsCode?: string | null;
  goodsVariationLabel?: string | null;
  goodsBrand?: string | null;
  goodsSize?: string | null;
  goodsOriginCountryName?: string | null;
  routeName?: string | null;
  shipmentType?: string | null;
  transportMode?: string | null;
  movementType?: string | null;
  exporterName?: string | null;
  importerName?: string | null;
  notifyPartyRequired?: boolean;
  notifyPartyName?: string | null;
  buyerName?: string | null;
  loadingSource?: string | null;
  loadingSourceName?: string | null;
  loadingCountryId?: string | null;
  loadingCountryName?: string | null;
  receivingCountryId?: string | null;
  receivingCountryName?: string | null;
  loadingPortId?: string | null;
  loadingPortName?: string | null;
  destinationPortId?: string | null;
  destinationPortName?: string | null;
  cargoDetails?: string | null;
  expectedLoadingDate?: string | null;
  remarks?: string | null;
  status?: string | null;
  orderNo?: string | null;
  partyLinks?: PartyLinkInput[];
  originalLanguage?: SupportedLanguage;
  countryId?: string | null;
  countryBranchId?: string | null;
  cityBranchId?: string | null;
  clearingAgentId?: string | null;
  createdBy?: string | null;
  // By Road truck (either a registered/permanent truck or a temporary one)
  truckId?: string | null;
  truckRegistrationType?: "registered" | "temporary" | null;
  truckNumber?: string | null;
  truckDriverName?: string | null;
  truckDriverMobile?: string | null;
  truckOwnerName?: string | null;
  truckTransportCompany?: string | null;
  truckDetails?: Record<string, unknown> | null;
  loadType?: "full_truck" | "partial_load" | "container_haulage" | null;
  loadingStateProvinceId?: string | null;
  loadingDistrictId?: string | null;
  loadingCityId?: string | null;
  loadingAreaId?: string | null;
  receivingStateProvinceId?: string | null;
  receivingDistrictId?: string | null;
  receivingCityId?: string | null;
  receivingAreaId?: string | null;
  loadingSourceWarehouseId?: string | null;
  loadingSourceContainerRef?: string | null;
  goodsQuantity?: number | null;
  goodsUnit?: string | null;
  goodsBagsCartons?: number | null;
  goodsGrossWeight?: number | null;
  goodsEmptyWeight?: number | null;
  goodsNetWeight?: number | null;
  legs?: OrderLegInput[];
  loadingAllocations?: LoadingAllocationInput[];
};

export type LoadingAllocationInput = {
  id?: string | null;
  rowSerial?: number | null;
  warehouseId?: string | null;
  sourceLocationText?: string | null;
  quantity?: number | null;
  unit?: string | null;
  remarks?: string | null;
};

export type ClearingCustomerOrderLoadingAllocationRow = Record<string, any> & { id: string; order_id: string };

export type OrderLegInput = {
  id?: string | null;
  legNo?: number | null;
  fromCountryId?: string | null;
  fromCountryName?: string | null;
  toCountryId?: string | null;
  toCountryName?: string | null;
  fromLocationText?: string | null;
  toLocationText?: string | null;
  transportMode?: "by_sea" | "by_road" | "by_air" | "by_rail" | null;
  responsibleCountryBranchId?: string | null;
  responsibleCityBranchId?: string | null;
  responsibleClearingAgentId?: string | null;
  truckId?: string | null;
  truckRegistrationType?: "registered" | "temporary" | null;
  truckNumber?: string | null;
  truckDriverName?: string | null;
  truckDriverMobile?: string | null;
  shippingLineId?: string | null;
  vesselName?: string | null;
  voyageNumber?: string | null;
  containerNumber?: string | null;
  sealNumber?: string | null;
  blNumber?: string | null;
  portOfLoading?: string | null;
  portOfDischarge?: string | null;
  etd?: string | null;
  eta?: string | null;
  customsCountryId?: string | null;
  customsPointText?: string | null;
  customsClearingAgentId?: string | null;
  clearanceType?: "import" | "export" | "transit" | null;
  dutyTreatment?: "duty_payable" | "no_duty_exempt" | "transit_bonded" | "pending" | null;
  dutyAmount?: number | null;
  dutyCurrency?: string | null;
  dutyPayer?: string | null;
  customsReceiptRef?: string | null;
  customsClearanceDate?: string | null;
  plannedDeparture?: string | null;
  actualDeparture?: string | null;
  plannedArrival?: string | null;
  actualArrival?: string | null;
  status?: string | null;
  handoverId?: string | null;
  remarks?: string | null;
  responsibleUserId?: string | null;
  billOfEntryNo?: string | null;
  pgmNumber?: string | null;
  declarationReference?: string | null;
  taxAmount?: number | null;
  otherCharges?: number | null;
  customsStatus?: "not_applicable" | "pending" | "submitted" | "cleared" | "held" | "rejected" | null;
  estimatedExpenseAmount?: number | null;
  actualExpenseAmount?: number | null;
  expenseCurrency?: string | null;
};

export type ClearingCustomerOrderLegRow = Record<string, any> & { id: string; order_id: string };

export type ClearingCustomerOrderPartyRow = {
  id: string;
  order_id: string;
  role_key: PartyRoleKey;
  party_customer_id: string | null;
  party_customer_name: string;
  party_company_id: string | null;
  party_company_name: string | null;
  selected_address_text: string | null;
  selected_address_source: string | null;
  country_id: string | null;
  country_branch_id: string | null;
  city_branch_id: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type ClearingCustomerOrderRow = Record<string, any> & {
  party_links?: ClearingCustomerOrderPartyRow[];
};

function trimOrNull(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeRole(roleKey: string): PartyRoleKey | null {
  if (roleKey === "supplier" || roleKey === "importer" || roleKey === "exporter" || roleKey === "notify_party" || roleKey === "buyer") {
    return roleKey;
  }
  return null;
}

function normalizeLinks(links: PartyLinkInput[] | undefined | null, fallbackPartyName: string): PartyLinkInput[] {
  const unique = new Map<PartyRoleKey, PartyLinkInput>();
  for (const raw of links ?? []) {
    const roleKey = normalizeRole(String(raw?.roleKey || ""));
    if (!roleKey) continue;
    const partyCustomerName = trimOrNull(raw.partyCustomerName) ?? (roleKey === "supplier" ? fallbackPartyName : null);
    if (!partyCustomerName) continue;
    unique.set(roleKey, {
      roleKey,
      partyCustomerId: trimOrNull(raw.partyCustomerId),
      partyCustomerName,
      partyCompanyId: trimOrNull(raw.partyCompanyId),
      partyCompanyName: trimOrNull(raw.partyCompanyName),
      selectedAddressText: trimOrNull(raw.selectedAddressText),
      selectedAddressSource: trimOrNull(raw.selectedAddressSource)
    });
  }
  return Array.from(unique.values());
}

const LEG_TRANSPORT_MODES = new Set(["by_sea", "by_road", "by_air", "by_rail"]);
const LEG_TRUCK_REG_TYPES = new Set(["registered", "temporary"]);
const LEG_CLEARANCE_TYPES = new Set(["import", "export", "transit"]);
const LEG_DUTY_TREATMENTS = new Set(["duty_payable", "no_duty_exempt", "transit_bonded", "pending"]);
const LEG_CUSTOMS_STATUSES = new Set(["not_applicable", "pending", "submitted", "cleared", "held", "rejected"]);

function normalizeLegs(legs: OrderLegInput[] | undefined | null): OrderLegInput[] {
  return (legs ?? [])
    .map((leg, index) => ({
      id: trimOrNull(leg.id),
      legNo: leg.legNo && leg.legNo > 0 ? leg.legNo : index + 1,
      fromCountryId: trimOrNull(leg.fromCountryId),
      fromCountryName: trimOrNull(leg.fromCountryName),
      toCountryId: trimOrNull(leg.toCountryId),
      toCountryName: trimOrNull(leg.toCountryName),
      fromLocationText: trimOrNull(leg.fromLocationText),
      toLocationText: trimOrNull(leg.toLocationText),
      transportMode: LEG_TRANSPORT_MODES.has(String(leg.transportMode)) ? (leg.transportMode as OrderLegInput["transportMode"]) : null,
      responsibleCountryBranchId: trimOrNull(leg.responsibleCountryBranchId),
      responsibleCityBranchId: trimOrNull(leg.responsibleCityBranchId),
      responsibleClearingAgentId: trimOrNull(leg.responsibleClearingAgentId),
      truckId: trimOrNull(leg.truckId),
      truckRegistrationType: LEG_TRUCK_REG_TYPES.has(String(leg.truckRegistrationType)) ? (leg.truckRegistrationType as OrderLegInput["truckRegistrationType"]) : null,
      truckNumber: trimOrNull(leg.truckNumber),
      truckDriverName: trimOrNull(leg.truckDriverName),
      truckDriverMobile: trimOrNull(leg.truckDriverMobile),
      shippingLineId: trimOrNull(leg.shippingLineId),
      vesselName: trimOrNull(leg.vesselName),
      voyageNumber: trimOrNull(leg.voyageNumber),
      containerNumber: trimOrNull(leg.containerNumber),
      sealNumber: trimOrNull(leg.sealNumber),
      blNumber: trimOrNull(leg.blNumber),
      portOfLoading: trimOrNull(leg.portOfLoading),
      portOfDischarge: trimOrNull(leg.portOfDischarge),
      etd: leg.etd || null,
      eta: leg.eta || null,
      customsCountryId: trimOrNull(leg.customsCountryId),
      customsPointText: trimOrNull(leg.customsPointText),
      customsClearingAgentId: trimOrNull(leg.customsClearingAgentId),
      clearanceType: LEG_CLEARANCE_TYPES.has(String(leg.clearanceType)) ? (leg.clearanceType as OrderLegInput["clearanceType"]) : null,
      dutyTreatment: LEG_DUTY_TREATMENTS.has(String(leg.dutyTreatment)) ? (leg.dutyTreatment as OrderLegInput["dutyTreatment"]) : null,
      dutyAmount: typeof leg.dutyAmount === "number" ? leg.dutyAmount : null,
      dutyCurrency: trimOrNull(leg.dutyCurrency),
      dutyPayer: trimOrNull(leg.dutyPayer),
      customsReceiptRef: trimOrNull(leg.customsReceiptRef),
      customsClearanceDate: leg.customsClearanceDate || null,
      plannedDeparture: leg.plannedDeparture || null,
      actualDeparture: leg.actualDeparture || null,
      plannedArrival: leg.plannedArrival || null,
      actualArrival: leg.actualArrival || null,
      status: trimOrNull(leg.status) ?? "pending",
      handoverId: trimOrNull(leg.handoverId),
      remarks: trimOrNull(leg.remarks),
      responsibleUserId: trimOrNull(leg.responsibleUserId),
      billOfEntryNo: trimOrNull(leg.billOfEntryNo),
      pgmNumber: trimOrNull(leg.pgmNumber),
      declarationReference: trimOrNull(leg.declarationReference),
      taxAmount: typeof leg.taxAmount === "number" ? leg.taxAmount : null,
      otherCharges: typeof leg.otherCharges === "number" ? leg.otherCharges : null,
      customsStatus: LEG_CUSTOMS_STATUSES.has(String(leg.customsStatus)) ? (leg.customsStatus as OrderLegInput["customsStatus"]) : "not_applicable",
      estimatedExpenseAmount: typeof leg.estimatedExpenseAmount === "number" ? leg.estimatedExpenseAmount : null,
      actualExpenseAmount: typeof leg.actualExpenseAmount === "number" ? leg.actualExpenseAmount : null,
      expenseCurrency: trimOrNull(leg.expenseCurrency)
    }))
    .filter((leg) => leg.fromCountryId || leg.toCountryId || leg.fromLocationText || leg.toLocationText || leg.transportMode);
}

function normalizeLoadingAllocations(rows: LoadingAllocationInput[] | undefined | null): LoadingAllocationInput[] {
  return (rows ?? [])
    .map((row, index) => ({
      id: trimOrNull(row.id),
      rowSerial: row.rowSerial && row.rowSerial > 0 ? row.rowSerial : index + 1,
      warehouseId: trimOrNull(row.warehouseId),
      sourceLocationText: trimOrNull(row.sourceLocationText),
      quantity: typeof row.quantity === "number" ? row.quantity : 0,
      unit: trimOrNull(row.unit),
      remarks: trimOrNull(row.remarks)
    }))
    .filter((row) => row.warehouseId || row.sourceLocationText || row.quantity > 0);
}

async function withOrderDb<T>(fn: (sql: any) => Promise<T>): Promise<T> {
  const result = await withLocalPg(async (sql) => fn(sql));
  if (result === null) {
    throw new Error("Local development DATABASE_URL is required for Shipping/Clearing customer-order persistence.");
  }
  return result;
}

async function syncOrderTranslations(
  order: Record<string, any>,
  links: ClearingCustomerOrderPartyRow[],
  legs: ClearingCustomerOrderLegRow[],
  originalLanguage: SupportedLanguage,
  allocations: ClearingCustomerOrderLoadingAllocationRow[] = []
) {
  await syncRecordTranslations({
    table: "clearing_customer_orders",
    recordId: order.id,
    record: order,
    originalLanguage
  });
  for (const link of links) {
    await syncRecordTranslations({
      table: "clearing_customer_order_parties",
      recordId: link.id,
      record: link,
      originalLanguage
    });
  }
  for (const leg of legs) {
    await syncRecordTranslations({
      table: "clearing_customer_order_legs",
      recordId: leg.id,
      record: leg,
      originalLanguage
    });
  }
  for (const alloc of allocations) {
    await syncRecordTranslations({
      table: "clearing_customer_order_loading_allocations",
      recordId: alloc.id,
      record: alloc,
      originalLanguage
    });
  }
}

function groupByOrder<T extends { order_id: string }>(rows: T[]) {
  const map = new Map<string, T[]>();
  for (const row of rows) {
    if (!map.has(row.order_id)) map.set(row.order_id, []);
    map.get(row.order_id)!.push(row);
  }
  return map;
}

export type CustomerOrderScopeFilter = {
  isSuperAdmin: boolean;
  countryIds?: string[] | null;
  countryBranchIds?: string[] | null;
  cityBranchIds?: string[] | null;
  clearingAgentIds?: string[] | null;
  createdByUserId?: string | null;
};

export async function listCustomerOrders(status?: string | null, scope?: CustomerOrderScopeFilter | null) {
  return await withOrderDb(async (sql) => {
    const conditions: any[] = [sql`deleted_at is null`];
    if (status && status !== "all") conditions.push(sql`status = ${status}`);

    if (scope && !scope.isSuperAdmin) {
      // Priority order matches enforceScopeFilter: clearing-agent isolation first (shipping-scoped
      // logins), then city branch, then country branch, then country, then "only what I created"
      // for a plain agent/staff user with no elevated scope of their own — narrowest available wins.
      if (scope.clearingAgentIds && scope.clearingAgentIds.length > 0) {
        conditions.push(sql`clearing_agent_id = ANY(${scope.clearingAgentIds}::uuid[])`);
      } else if (scope.cityBranchIds && scope.cityBranchIds.length > 0) {
        conditions.push(sql`city_branch_id = ANY(${scope.cityBranchIds}::uuid[])`);
      } else if (scope.countryBranchIds && scope.countryBranchIds.length > 0) {
        conditions.push(sql`country_branch_id = ANY(${scope.countryBranchIds}::uuid[])`);
      } else if (scope.countryIds && scope.countryIds.length > 0) {
        conditions.push(sql`country_id = ANY(${scope.countryIds}::uuid[])`);
      } else if (scope.createdByUserId) {
        conditions.push(sql`created_by = ${scope.createdByUserId}::uuid`);
      } else {
        // No scope at all — fail safe to nothing, matching enforceScopeFilter's own fail-safe.
        conditions.push(sql`id = '00000000-0000-0000-0000-000000000000'::uuid`);
      }
    }

    let whereClause = conditions[0];
    for (let i = 1; i < conditions.length; i++) whereClause = sql`${whereClause} and ${conditions[i]}`;

    const orders = await sql`
      select * from public.clearing_customer_orders
      where ${whereClause}
      order by created_at desc
    `;

    const orderIds = (orders ?? []).map((row: any) => row.id).filter(Boolean);
    const [links, legs, allocations] = orderIds.length
      ? await Promise.all([
          sql`select * from public.clearing_customer_order_parties where deleted_at is null and order_id = ANY(${orderIds}::uuid[]) order by created_at asc`,
          sql`select * from public.clearing_customer_order_legs where deleted_at is null and order_id = ANY(${orderIds}::uuid[]) order by leg_no asc`,
          sql`select * from public.clearing_customer_order_loading_allocations where deleted_at is null and order_id = ANY(${orderIds}::uuid[]) order by row_serial asc`
        ])
      : [[], [], []];

    const linksByOrder = groupByOrder(links as ClearingCustomerOrderPartyRow[]);
    const legsByOrder = groupByOrder(legs as ClearingCustomerOrderLegRow[]);
    const allocationsByOrder = groupByOrder(allocations as ClearingCustomerOrderLoadingAllocationRow[]);
    return (orders ?? []).map((row: any) => ({
      ...row,
      party_links: linksByOrder.get(row.id) ?? [],
      legs: legsByOrder.get(row.id) ?? [],
      loading_allocations: allocationsByOrder.get(row.id) ?? []
    })) as ClearingCustomerOrderRow[];
  });
}

export async function getCustomerOrderById(id: string) {
  return await withOrderDb(async (sql) => {
    const [order] = await sql`
      select *
      from public.clearing_customer_orders
      where id = ${id}::uuid and deleted_at is null
      limit 1
    `;
    if (!order) return null;
    const [links, legs, allocations] = await Promise.all([
      sql`select * from public.clearing_customer_order_parties where deleted_at is null and order_id = ${id}::uuid order by created_at asc`,
      sql`select * from public.clearing_customer_order_legs where deleted_at is null and order_id = ${id}::uuid order by leg_no asc`,
      sql`select * from public.clearing_customer_order_loading_allocations where deleted_at is null and order_id = ${id}::uuid order by row_serial asc`
    ]);
    return {
      ...(order as Record<string, any>),
      party_links: links as ClearingCustomerOrderPartyRow[],
      legs: legs as ClearingCustomerOrderLegRow[],
      loading_allocations: allocations as ClearingCustomerOrderLoadingAllocationRow[]
    } as ClearingCustomerOrderRow;
  });
}

export async function saveCustomerOrder(input: ClearingCustomerOrderInput) {
  return await withOrderDb(async (sql) => {
    return await sql.begin(async (tx: any) => {
      const now = new Date().toISOString();
      const orderId = input.id ?? null;
      const hasPartyLinksPayload = input.partyLinks !== undefined;
      const hasLegsPayload = input.legs !== undefined;
      let orderNo = trimOrNull(input.orderNo);

      // The permanent "Global Bill / Shipping Number" — a single atomic, never-reused
      // sequence (not a count(*)+1 scheme, which is race-prone and rebases on delete).
      if (!orderId && !orderNo) {
        const [seqRow] = await tx`select public.next_entity_serial('global', 'GLOBAL', 'clearing_customer_orders', 'CL-ORD') as serial`;
        orderNo = seqRow?.serial ?? null;
      }

      let allocatedSerials: { superAdminSerial: string | null; countrySerial: string | null; branchSerial: string | null; entrySerial: string | null } = {
        superAdminSerial: null, countrySerial: null, branchSerial: null, entrySerial: null
      };
      if (!orderId) {
        try {
          // Must run on the SAME transaction connection (tx), not a fresh pool connection —
          // allocate_4level_serials() upserts the identical (scope_type, scope_key, entity_type)
          // row in transaction_serial_sequences that next_entity_serial() just locked above.
          // A separate connection would block on that row until this transaction commits,
          // while this transaction is itself awaiting that same call: a guaranteed deadlock.
          const [serialRow] = await tx`
            select allocate_4level_serials(
              'clearing_customer_orders',
              ${input.countryId ?? "GLOBAL"},
              ${input.cityBranchId ?? input.countryBranchId ?? "GLOBAL"},
              'CCO'
            ) as res
          `;
          const res = serialRow?.res;
          if (res) {
            allocatedSerials = {
              superAdminSerial: res.super_admin_serial ?? null,
              countrySerial: res.country_serial ?? null,
              branchSerial: res.branch_serial ?? null,
              entrySerial: res.entry_serial ?? null
            };
          }
        } catch (err) {
          console.warn("Serial allocation failed for customer order (non-fatal):", err);
        }
      }

      const orderPayload = {
        order_no: orderNo,
        customer_id: trimOrNull(input.customerId),
        customer_name: trimOrNull(input.customerName) ?? "Shipping Party",
        goods_id: trimOrNull(input.goodsId),
        goods_variation_id: trimOrNull(input.goodsVariationId),
        goods_name: trimOrNull(input.goodsName),
        goods_chs_code: trimOrNull(input.goodsChsCode),
        goods_variation_label: trimOrNull(input.goodsVariationLabel),
        goods_brand: trimOrNull(input.goodsBrand),
        goods_size: trimOrNull(input.goodsSize),
        goods_origin_country_name: trimOrNull(input.goodsOriginCountryName),
        route_name: trimOrNull(input.routeName),
        shipment_type: trimOrNull(input.shipmentType) ?? "FCL",
        transport_mode: trimOrNull(input.transportMode) ?? "by_sea",
        movement_type: trimOrNull(input.movementType) ?? "import",
        exporter_name: trimOrNull(input.exporterName),
        importer_name: trimOrNull(input.importerName),
        notify_party_required: Boolean(input.notifyPartyRequired),
        notify_party_name: trimOrNull(input.notifyPartyName),
        buyer_name: trimOrNull(input.buyerName),
        loading_source: trimOrNull(input.loadingSource),
        loading_source_name: trimOrNull(input.loadingSourceName),
        loading_country_id: trimOrNull(input.loadingCountryId),
        loading_country_name: trimOrNull(input.loadingCountryName),
        receiving_country_id: trimOrNull(input.receivingCountryId),
        receiving_country_name: trimOrNull(input.receivingCountryName),
        loading_port_id: trimOrNull(input.loadingPortId),
        loading_port_name: trimOrNull(input.loadingPortName),
        destination_port_id: trimOrNull(input.destinationPortId),
        destination_port_name: trimOrNull(input.destinationPortName),
        cargo_details: trimOrNull(input.cargoDetails),
        expected_loading_date: input.expectedLoadingDate || new Date().toISOString(),
        remarks: trimOrNull(input.remarks),
        status: trimOrNull(input.status) ?? "pending",
        country_id: trimOrNull(input.countryId),
        country_branch_id: trimOrNull(input.countryBranchId),
        city_branch_id: trimOrNull(input.cityBranchId),
        clearing_agent_id: trimOrNull(input.clearingAgentId),
        load_type: trimOrNull(input.loadType),
        loading_state_province_id: trimOrNull(input.loadingStateProvinceId),
        loading_district_id: trimOrNull(input.loadingDistrictId),
        loading_city_id: trimOrNull(input.loadingCityId),
        loading_area_id: trimOrNull(input.loadingAreaId),
        receiving_state_province_id: trimOrNull(input.receivingStateProvinceId),
        receiving_district_id: trimOrNull(input.receivingDistrictId),
        receiving_city_id: trimOrNull(input.receivingCityId),
        receiving_area_id: trimOrNull(input.receivingAreaId),
        loading_source_warehouse_id: trimOrNull(input.loadingSourceWarehouseId),
        loading_source_container_ref: trimOrNull(input.loadingSourceContainerRef),
        goods_quantity: typeof input.goodsQuantity === "number" ? input.goodsQuantity : null,
        goods_unit: trimOrNull(input.goodsUnit),
        goods_bags_cartons: typeof input.goodsBagsCartons === "number" ? input.goodsBagsCartons : null,
        goods_gross_weight: typeof input.goodsGrossWeight === "number" ? input.goodsGrossWeight : null,
        goods_empty_weight: typeof input.goodsEmptyWeight === "number" ? input.goodsEmptyWeight : null,
        goods_net_weight: typeof input.goodsNetWeight === "number" ? input.goodsNetWeight : null,
        updated_at: now
      };

      // By Road truck linkage — only kept for road transport.
      const isRoad = orderPayload.transport_mode === "by_road";
      const regType = input.truckRegistrationType === "registered" || input.truckRegistrationType === "temporary"
        ? input.truckRegistrationType : null;
      const truckPayload = isRoad ? {
        truck_id: regType === "registered" ? (trimOrNull(input.truckId) as string | null) : null,
        truck_registration_type: regType,
        truck_number: trimOrNull(input.truckNumber),
        truck_driver_name: trimOrNull(input.truckDriverName),
        truck_driver_mobile: trimOrNull(input.truckDriverMobile),
        truck_owner_name: trimOrNull(input.truckOwnerName),
        truck_transport_company: trimOrNull(input.truckTransportCompany),
        // pass the object through — the postgres driver serialises it to jsonb.
        // (JSON.stringify + ::jsonb double-encodes into a jsonb *string*.)
        truck_details: input.truckDetails && Object.keys(input.truckDetails).length ? input.truckDetails : null,
      } : {
        truck_id: null, truck_registration_type: null, truck_number: null, truck_driver_name: null,
        truck_driver_mobile: null, truck_owner_name: null, truck_transport_company: null, truck_details: null,
      };

      let orderRow: Record<string, any>;
      if (orderId) {
        const [updated] = await tx`
          update public.clearing_customer_orders
          set customer_id = ${orderPayload.customer_id},
              customer_name = ${orderPayload.customer_name},
              goods_id = ${orderPayload.goods_id},
              goods_variation_id = ${orderPayload.goods_variation_id},
              goods_name = ${orderPayload.goods_name},
              goods_chs_code = ${orderPayload.goods_chs_code},
              goods_variation_label = ${orderPayload.goods_variation_label},
              goods_brand = ${orderPayload.goods_brand},
              goods_size = ${orderPayload.goods_size},
              goods_origin_country_name = ${orderPayload.goods_origin_country_name},
              route_name = ${orderPayload.route_name},
              shipment_type = ${orderPayload.shipment_type},
              transport_mode = ${orderPayload.transport_mode},
              movement_type = ${orderPayload.movement_type},
              exporter_name = ${orderPayload.exporter_name},
              importer_name = ${orderPayload.importer_name},
              notify_party_required = ${orderPayload.notify_party_required},
              notify_party_name = ${orderPayload.notify_party_name},
              buyer_name = ${orderPayload.buyer_name},
              loading_source = ${orderPayload.loading_source},
              loading_source_name = ${orderPayload.loading_source_name},
              loading_country_id = ${orderPayload.loading_country_id},
              loading_country_name = ${orderPayload.loading_country_name},
              receiving_country_id = ${orderPayload.receiving_country_id},
              receiving_country_name = ${orderPayload.receiving_country_name},
              loading_port_id = ${orderPayload.loading_port_id},
              loading_port_name = ${orderPayload.loading_port_name},
              destination_port_id = ${orderPayload.destination_port_id},
              destination_port_name = ${orderPayload.destination_port_name},
              cargo_details = ${orderPayload.cargo_details},
              expected_loading_date = ${orderPayload.expected_loading_date},
              remarks = ${orderPayload.remarks},
              status = ${orderPayload.status},
              country_id = coalesce(${orderPayload.country_id}::uuid, country_id),
              country_branch_id = coalesce(${orderPayload.country_branch_id}::uuid, country_branch_id),
              city_branch_id = coalesce(${orderPayload.city_branch_id}::uuid, city_branch_id),
              clearing_agent_id = coalesce(${orderPayload.clearing_agent_id}::uuid, clearing_agent_id),
              load_type = ${orderPayload.load_type},
              loading_state_province_id = ${orderPayload.loading_state_province_id}::uuid,
              loading_district_id = ${orderPayload.loading_district_id}::uuid,
              loading_city_id = ${orderPayload.loading_city_id}::uuid,
              loading_area_id = ${orderPayload.loading_area_id}::uuid,
              receiving_state_province_id = ${orderPayload.receiving_state_province_id}::uuid,
              receiving_district_id = ${orderPayload.receiving_district_id}::uuid,
              receiving_city_id = ${orderPayload.receiving_city_id}::uuid,
              receiving_area_id = ${orderPayload.receiving_area_id}::uuid,
              loading_source_warehouse_id = ${orderPayload.loading_source_warehouse_id}::uuid,
              loading_source_container_ref = ${orderPayload.loading_source_container_ref},
              goods_quantity = ${orderPayload.goods_quantity},
              goods_unit = ${orderPayload.goods_unit},
              goods_bags_cartons = ${orderPayload.goods_bags_cartons},
              goods_gross_weight = ${orderPayload.goods_gross_weight},
              goods_empty_weight = ${orderPayload.goods_empty_weight},
              goods_net_weight = ${orderPayload.goods_net_weight},
              truck_id = ${truckPayload.truck_id},
              truck_registration_type = ${truckPayload.truck_registration_type},
              truck_number = ${truckPayload.truck_number},
              truck_driver_name = ${truckPayload.truck_driver_name},
              truck_driver_mobile = ${truckPayload.truck_driver_mobile},
              truck_owner_name = ${truckPayload.truck_owner_name},
              truck_transport_company = ${truckPayload.truck_transport_company},
              truck_details = ${truckPayload.truck_details}::jsonb,
              updated_at = ${now}
          where id = ${orderId}::uuid and deleted_at is null
          returning *
        `;
        if (!updated) throw new Error("Customer order not found.");
        orderRow = updated as Record<string, any>;

        await tx`
          delete from public.clearing_customer_order_parties
          where order_id = ${orderId}::uuid
        `;
      } else {
        const [inserted] = await tx`
          insert into public.clearing_customer_orders (
            order_no, customer_id, customer_name, goods_id, goods_variation_id, goods_name, goods_chs_code,
            goods_variation_label, goods_brand, goods_size, goods_origin_country_name,
            route_name, shipment_type, transport_mode, movement_type,
            exporter_name, importer_name, notify_party_required, notify_party_name, buyer_name,
            loading_source, loading_source_name, loading_country_id, loading_country_name,
            receiving_country_id, receiving_country_name, loading_port_id, loading_port_name,
            destination_port_id, destination_port_name, cargo_details, expected_loading_date, remarks,
            status,
            country_id, country_branch_id, city_branch_id, clearing_agent_id, created_by,
            super_admin_serial, country_serial, branch_serial, entry_serial,
            load_type, loading_state_province_id, loading_district_id, loading_city_id, loading_area_id,
            receiving_state_province_id, receiving_district_id, receiving_city_id, receiving_area_id,
            loading_source_warehouse_id, loading_source_container_ref,
            goods_quantity, goods_unit, goods_bags_cartons, goods_gross_weight, goods_empty_weight, goods_net_weight,
            truck_id, truck_registration_type, truck_number, truck_driver_name, truck_driver_mobile,
            truck_owner_name, truck_transport_company, truck_details,
            created_at, updated_at
          ) values (
            ${orderPayload.order_no}, ${orderPayload.customer_id}, ${orderPayload.customer_name}, ${orderPayload.goods_id},
            ${orderPayload.goods_variation_id}, ${orderPayload.goods_name}, ${orderPayload.goods_chs_code},
            ${orderPayload.goods_variation_label}, ${orderPayload.goods_brand}, ${orderPayload.goods_size},
            ${orderPayload.goods_origin_country_name}, ${orderPayload.route_name},
            ${orderPayload.shipment_type}, ${orderPayload.transport_mode}, ${orderPayload.movement_type},
            ${orderPayload.exporter_name}, ${orderPayload.importer_name}, ${orderPayload.notify_party_required},
            ${orderPayload.notify_party_name}, ${orderPayload.buyer_name}, ${orderPayload.loading_source},
            ${orderPayload.loading_source_name}, ${orderPayload.loading_country_id}, ${orderPayload.loading_country_name},
            ${orderPayload.receiving_country_id}, ${orderPayload.receiving_country_name}, ${orderPayload.loading_port_id},
            ${orderPayload.loading_port_name}, ${orderPayload.destination_port_id}, ${orderPayload.destination_port_name},
            ${orderPayload.cargo_details}, ${orderPayload.expected_loading_date}, ${orderPayload.remarks},
            ${orderPayload.status},
            ${orderPayload.country_id}::uuid, ${orderPayload.country_branch_id}::uuid, ${orderPayload.city_branch_id}::uuid,
            ${orderPayload.clearing_agent_id}::uuid, ${trimOrNull(input.createdBy)}::uuid,
            ${allocatedSerials.superAdminSerial}, ${allocatedSerials.countrySerial}, ${allocatedSerials.branchSerial}, ${allocatedSerials.entrySerial},
            ${orderPayload.load_type}, ${orderPayload.loading_state_province_id}::uuid, ${orderPayload.loading_district_id}::uuid,
            ${orderPayload.loading_city_id}::uuid, ${orderPayload.loading_area_id}::uuid,
            ${orderPayload.receiving_state_province_id}::uuid, ${orderPayload.receiving_district_id}::uuid,
            ${orderPayload.receiving_city_id}::uuid, ${orderPayload.receiving_area_id}::uuid,
            ${orderPayload.loading_source_warehouse_id}::uuid, ${orderPayload.loading_source_container_ref},
            ${orderPayload.goods_quantity}, ${orderPayload.goods_unit}, ${orderPayload.goods_bags_cartons},
            ${orderPayload.goods_gross_weight}, ${orderPayload.goods_empty_weight}, ${orderPayload.goods_net_weight},
            ${truckPayload.truck_id}, ${truckPayload.truck_registration_type}, ${truckPayload.truck_number},
            ${truckPayload.truck_driver_name}, ${truckPayload.truck_driver_mobile}, ${truckPayload.truck_owner_name},
            ${truckPayload.truck_transport_company}, ${truckPayload.truck_details}::jsonb,
            ${now}, ${now}
          )
          returning *
        `;
        if (!inserted) throw new Error("Failed to create customer order.");
        orderRow = inserted as Record<string, any>;
      }

      let partyRows: ClearingCustomerOrderPartyRow[] = [];
      if (hasPartyLinksPayload) {
        const normalizedLinks = normalizeLinks(input.partyLinks, orderPayload.customer_name).map((link) => ({
          order_id: orderRow.id,
          role_key: link.roleKey,
          party_customer_id: link.partyCustomerId,
          party_customer_name: link.partyCustomerName?.trim() || orderPayload.customer_name,
          party_company_id: link.partyCompanyId,
          party_company_name: trimOrNull(link.partyCompanyName),
          selected_address_text: trimOrNull(link.selectedAddressText),
          selected_address_source: trimOrNull(link.selectedAddressSource),
          country_id: input.countryId ?? null,
          country_branch_id: input.countryBranchId ?? null,
          city_branch_id: input.cityBranchId ?? null,
          created_at: now,
          updated_at: now
        }));

        if (orderId) {
          await tx`
            delete from public.clearing_customer_order_parties
            where order_id = ${orderId}::uuid
          `;
        }

        if (normalizedLinks.length) {
          partyRows = await tx`
            insert into public.clearing_customer_order_parties ${tx(normalizedLinks)}
            returning *
          `;
        }
      } else {
        partyRows = await tx`
          select *
          from public.clearing_customer_order_parties
          where deleted_at is null and order_id = ${orderRow.id}::uuid
          order by created_at asc
        `;
      }

      let legRows: ClearingCustomerOrderLegRow[] = [];
      if (hasLegsPayload) {
        const normalizedLegs = normalizeLegs(input.legs);

        // Upsert BY ID rather than delete-all-then-reinsert: a leg's id must stay
        // stable across saves, because DocumentAttachmentIcon (generic documents
        // system), a leg's current_task_id (user_tasks handoff), and external FKs
        // (clearing_payment_bills.leg_id, shipping_bl_records.leg_id, etc.) all
        // reference a specific leg by id. Deleting and reinserting on every save
        // silently orphaned every one of those the moment the order was resaved.
        const existingIds: string[] = orderId
          ? (await tx`select id from public.clearing_customer_order_legs where order_id = ${orderId}::uuid and deleted_at is null`).map((r: any) => r.id)
          : [];
        const keptIds = new Set<string>();

        for (const leg of normalizedLegs) {
          const legPayload = {
            order_id: orderRow.id,
            leg_no: leg.legNo,
            from_country_id: leg.fromCountryId,
            from_country_name: leg.fromCountryName,
            to_country_id: leg.toCountryId,
            to_country_name: leg.toCountryName,
            from_location_text: leg.fromLocationText,
            to_location_text: leg.toLocationText,
            transport_mode: leg.transportMode,
            responsible_country_branch_id: leg.responsibleCountryBranchId,
            responsible_city_branch_id: leg.responsibleCityBranchId,
            responsible_clearing_agent_id: leg.responsibleClearingAgentId,
            responsible_user_id: leg.responsibleUserId,
            truck_id: leg.truckRegistrationType === "registered" ? leg.truckId : null,
            truck_registration_type: leg.truckRegistrationType,
            truck_number: leg.truckNumber,
            truck_driver_name: leg.truckDriverName,
            truck_driver_mobile: leg.truckDriverMobile,
            shipping_line_id: leg.shippingLineId,
            vessel_name: leg.vesselName,
            voyage_number: leg.voyageNumber,
            container_number: leg.containerNumber,
            seal_number: leg.sealNumber,
            bl_number: leg.blNumber,
            port_of_loading: leg.portOfLoading,
            port_of_discharge: leg.portOfDischarge,
            etd: leg.etd,
            eta: leg.eta,
            customs_country_id: leg.customsCountryId,
            customs_point_text: leg.customsPointText,
            customs_clearing_agent_id: leg.customsClearingAgentId,
            clearance_type: leg.clearanceType,
            duty_treatment: leg.dutyTreatment,
            duty_amount: leg.dutyAmount,
            duty_currency: leg.dutyCurrency,
            duty_payer: leg.dutyPayer,
            customs_receipt_ref: leg.customsReceiptRef,
            customs_clearance_date: leg.customsClearanceDate,
            bill_of_entry_no: leg.billOfEntryNo,
            pgm_number: leg.pgmNumber,
            declaration_reference: leg.declarationReference,
            tax_amount: leg.taxAmount,
            other_charges: leg.otherCharges,
            customs_status: leg.customsStatus ?? "not_applicable",
            estimated_expense_amount: leg.estimatedExpenseAmount,
            actual_expense_amount: leg.actualExpenseAmount,
            expense_currency: leg.expenseCurrency,
            planned_departure: leg.plannedDeparture,
            actual_departure: leg.actualDeparture,
            planned_arrival: leg.plannedArrival,
            actual_arrival: leg.actualArrival,
            status: leg.status,
            handover_id: leg.handoverId,
            remarks: leg.remarks,
            updated_at: now
          };

          if (leg.id && existingIds.includes(leg.id)) {
            keptIds.add(leg.id);
            const [updatedLeg] = await tx`
              update public.clearing_customer_order_legs
              set ${tx(legPayload as any)}
              where id = ${leg.id}::uuid
              returning *
            `;
            if (updatedLeg) legRows.push(updatedLeg as ClearingCustomerOrderLegRow);
          } else {
            const [insertedLeg] = await tx`
              insert into public.clearing_customer_order_legs ${tx({ ...legPayload, created_at: now })}
              returning *
            `;
            if (insertedLeg) {
              legRows.push(insertedLeg as ClearingCustomerOrderLegRow);
              keptIds.add(insertedLeg.id);
            }
          }
        }

        // Soft-delete legs the user removed from the order (present before, absent now).
        const removedIds = existingIds.filter((id) => !keptIds.has(id));
        if (removedIds.length) {
          await tx`
            update public.clearing_customer_order_legs
            set deleted_at = ${now}, updated_at = ${now}
            where id = ANY(${removedIds}::uuid[])
          `;
        }
        legRows.sort((a: any, b: any) => (a.leg_no ?? 0) - (b.leg_no ?? 0));
      } else {
        legRows = await tx`
          select *
          from public.clearing_customer_order_legs
          where deleted_at is null and order_id = ${orderRow.id}::uuid
          order by leg_no asc
        `;
      }

      let allocationRows: ClearingCustomerOrderLoadingAllocationRow[] = [];
      const hasAllocationsPayload = input.loadingAllocations !== undefined;
      if (hasAllocationsPayload) {
        const normalizedAllocations = normalizeLoadingAllocations(input.loadingAllocations);
        const existingAllocationIds: string[] = orderId
          ? (await tx`select id from public.clearing_customer_order_loading_allocations where order_id = ${orderId}::uuid and deleted_at is null`).map((r: any) => r.id)
          : [];
        const keptAllocationIds = new Set<string>();

        for (const alloc of normalizedAllocations) {
          const allocPayload = {
            order_id: orderRow.id,
            row_serial: alloc.rowSerial,
            warehouse_id: alloc.warehouseId,
            source_location_text: alloc.sourceLocationText,
            quantity: alloc.quantity,
            unit: alloc.unit,
            remarks: alloc.remarks,
            updated_at: now
          };
          if (alloc.id && existingAllocationIds.includes(alloc.id)) {
            keptAllocationIds.add(alloc.id);
            const [updatedAlloc] = await tx`
              update public.clearing_customer_order_loading_allocations
              set ${tx(allocPayload as any)}
              where id = ${alloc.id}::uuid
              returning *
            `;
            if (updatedAlloc) allocationRows.push(updatedAlloc as ClearingCustomerOrderLoadingAllocationRow);
          } else {
            const [insertedAlloc] = await tx`
              insert into public.clearing_customer_order_loading_allocations ${tx({ ...allocPayload, created_by: trimOrNull(input.createdBy), created_at: now })}
              returning *
            `;
            if (insertedAlloc) {
              allocationRows.push(insertedAlloc as ClearingCustomerOrderLoadingAllocationRow);
              keptAllocationIds.add(insertedAlloc.id);
            }
          }
        }

        const removedAllocationIds = existingAllocationIds.filter((id) => !keptAllocationIds.has(id));
        if (removedAllocationIds.length) {
          await tx`
            update public.clearing_customer_order_loading_allocations
            set deleted_at = ${now}, updated_at = ${now}
            where id = ANY(${removedAllocationIds}::uuid[])
          `;
        }
        allocationRows.sort((a: any, b: any) => (a.row_serial ?? 0) - (b.row_serial ?? 0));
      } else {
        allocationRows = await tx`
          select *
          from public.clearing_customer_order_loading_allocations
          where deleted_at is null and order_id = ${orderRow.id}::uuid
          order by row_serial asc
        `;
      }

      return { order: orderRow, partyLinks: partyRows as ClearingCustomerOrderPartyRow[], legs: legRows, loadingAllocations: allocationRows };
    });
  }).then(async (result) => {
    try {
      await syncOrderTranslations(result.order, result.partyLinks, result.legs, input.originalLanguage ?? "en", result.loadingAllocations);
    } catch (error) {
      console.warn("Customer-order translation sync failed after save; preserving saved shipping order.", error);
    }
    return result;
  });
}

export async function deleteCustomerOrder(id: string) {
  return await withOrderDb(async (sql) => {
    return await sql.begin(async (tx: any) => {
      const now = new Date().toISOString();
      const [updated] = await tx`
        update public.clearing_customer_orders
        set deleted_at = ${now},
            updated_at = ${now}
        where id = ${id}::uuid and deleted_at is null
        returning *
      `;
      if (!updated) throw new Error("Customer order not found.");
      await tx`
        update public.clearing_customer_order_parties
        set deleted_at = ${now},
            updated_at = ${now}
        where order_id = ${id}::uuid and deleted_at is null
      `;
      await tx`
        update public.clearing_customer_order_legs
        set deleted_at = ${now},
            updated_at = ${now}
        where order_id = ${id}::uuid and deleted_at is null
      `;
      return updated as Record<string, any>;
    });
  });
}

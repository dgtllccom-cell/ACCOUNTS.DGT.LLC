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
};

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
  originalLanguage: SupportedLanguage
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
}

function groupLinksByOrder(links: ClearingCustomerOrderPartyRow[]) {
  const map = new Map<string, ClearingCustomerOrderPartyRow[]>();
  for (const link of links) {
    if (!map.has(link.order_id)) map.set(link.order_id, []);
    map.get(link.order_id)!.push(link);
  }
  return map;
}

export async function listCustomerOrders(status?: string | null) {
  return await withOrderDb(async (sql) => {
    const orders = status && status !== "all"
      ? await sql`
          select *
          from public.clearing_customer_orders
          where deleted_at is null and status = ${status}
          order by created_at desc
        `
      : await sql`
          select *
          from public.clearing_customer_orders
          where deleted_at is null
          order by created_at desc
        `;

    const orderIds = (orders ?? []).map((row: any) => row.id).filter(Boolean);
    const links = orderIds.length
      ? await sql`
          select *
          from public.clearing_customer_order_parties
          where deleted_at is null
            and order_id = ANY(${orderIds}::uuid[])
          order by created_at asc
        `
      : [];

    const linksByOrder = groupLinksByOrder(links as ClearingCustomerOrderPartyRow[]);
    return (orders ?? []).map((row: any) => ({ ...row, party_links: linksByOrder.get(row.id) ?? [] })) as ClearingCustomerOrderRow[];
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
    const links = await sql`
      select *
      from public.clearing_customer_order_parties
      where deleted_at is null and order_id = ${id}::uuid
      order by created_at asc
    `;
    return { ...(order as Record<string, any>), party_links: links as ClearingCustomerOrderPartyRow[] } as ClearingCustomerOrderRow;
  });
}

export async function saveCustomerOrder(input: ClearingCustomerOrderInput) {
  return await withOrderDb(async (sql) => {
    return await sql.begin(async (tx: any) => {
      const now = new Date().toISOString();
      const orderId = input.id ?? null;
      const hasPartyLinksPayload = input.partyLinks !== undefined;
      let orderNo = trimOrNull(input.orderNo);

      if (!orderId && !orderNo) {
        const [countRow] = await tx`select count(*)::int as count from public.clearing_customer_orders where deleted_at is null`;
        const year = new Date().getFullYear();
        orderNo = `CL-ORD-${year}-${String(Number(countRow?.count || 0) + 1).padStart(4, "0")}`;
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
        updated_at: now
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
            status, created_at, updated_at
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
            ${orderPayload.status}, ${now}, ${now}
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

      return { order: orderRow, partyLinks: partyRows as ClearingCustomerOrderPartyRow[] };
    });
  }).then(async (result) => {
    try {
      await syncOrderTranslations(result.order, result.partyLinks, input.originalLanguage ?? "en");
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
      return updated as Record<string, any>;
    });
  });
}

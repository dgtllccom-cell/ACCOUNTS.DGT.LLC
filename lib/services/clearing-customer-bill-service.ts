import { withLocalPg } from "@/lib/db/local-postgres";
import { postRoznamchaWithErpSession } from "@/app/api/erp/roznamcha/posting";
import {
  ensureCustomerShippingLedger,
  ensureShippingRevenueLedger
} from "@/lib/services/clearing-bill-customer-charge-service";

export interface CustomerBillItemInput {
  id?: string;
  item_order?: number;
  charge_type: string;
  charge_name: string;
  description?: string | null;
  quantity: number;
  unit?: string;
  rate: number;
  tax_pct?: number;
  remarks?: string | null;
}

export interface CustomerBillSaveInput {
  id: string;
  orderIds?: string[];
  dueDate?: string | null;
  discountAmount?: number;
  otherCharges?: number;
  remarks?: string | null;
  items: CustomerBillItemInput[];
  actorId?: string | null;
}

export interface CustomerBillRow {
  id: string;
  order_id: string;
  order_ids?: string[];
  order_no: string | null;
  customer_id: string;
  customer_name: string | null;
  customer_account_id: string | null;
  customer_account_number: string | null;
  bill_no: string;
  bill_date: string;
  due_date: string | null;
  currency_code: string;
  exchange_rate: number;
  transport_mode: string | null;
  movement_type: string | null;
  shipment_type: string | null;
  loading_port_name: string | null;
  destination_port_name: string | null;
  truck_number: string | null;
  subtotal: number;
  tax_amount: number;
  discount_amount: number;
  other_charges: number;
  grand_total: number;
  paid_amount: number;
  balance_due: number;
  status: "draft" | "submitted" | "approved" | "posted" | "paid" | "cancelled";
  submitted_by: string | null;
  submitted_at: string | null;
  approved_by: string | null;
  approved_at: string | null;
  posted_by: string | null;
  posted_at: string | null;
  roznamcha_entry_id: string | null;
  super_admin_serial: string | null;
  country_serial: string | null;
  branch_serial: string | null;
  entry_serial: string | null;
  country_id: string | null;
  country_branch_id: string | null;
  city_branch_id: string | null;
  remarks: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  items?: CustomerBillItemRow[];
  order?: Record<string, any> | null;
  orders?: Array<Record<string, any>>;
}

export interface CustomerBillItemRow {
  id: string;
  bill_id: string;
  item_order: number;
  charge_type: string;
  charge_name: string;
  description: string | null;
  quantity: number;
  unit: string;
  rate: number;
  amount: number;
  tax_pct: number;
  tax_amount: number;
  total_amount: number;
  remarks: string | null;
  created_at: string;
  updated_at: string;
}

function normalizeOrderIds(orderIds: string[]): string[] {
  return Array.from(new Set(orderIds.map((value) => String(value).trim()).filter(Boolean)));
}

/**
 * Ensures a Customer Bill draft exists for one or more customer orders.
 * The bill keeps the first order in the legacy `order_id` column while every
 * selected order is persisted in clearing_customer_bill_orders. All selected
 * orders must belong to the same customer because a bill has one customer AR
 * account and one posting identity.
 */
export async function ensureCustomerBillForOrders(
  inputOrderIds: string[],
  actorId?: string | null
): Promise<CustomerBillRow> {
  const orderIds = normalizeOrderIds(inputOrderIds);
  if (orderIds.length === 0) throw new Error("At least one customer order is required.");

  const result = await withLocalPg(async (sql) => {
    // 1. Load and validate every selected order from the shared order master.
    const orders = await sql`
      SELECT * FROM public.clearing_customer_orders
      WHERE id = ANY(${orderIds}::uuid[]) AND deleted_at IS NULL
      ORDER BY array_position(${orderIds}::uuid[], id)
    `;
    if (orders.length !== orderIds.length) {
      throw new Error("One or more selected customer orders are no longer available.");
    }
    const customerIds = Array.from(new Set(orders.map((row: any) => row.customer_id).filter(Boolean)));
    if (customerIds.length > 1) {
      throw new Error("A customer bill can only include orders for one customer.");
    }
    const [primaryOrder] = orders;

    // 2. Reopen an existing bill when the selected order is already linked.
    const existing = await sql`
      SELECT b.*
      FROM public.clearing_customer_bills b
      LEFT JOIN public.clearing_customer_bill_orders bo ON bo.bill_id = b.id
      WHERE b.deleted_at IS NULL
        AND (b.order_id = ANY(${orderIds}::uuid[]) OR bo.order_id = ANY(${orderIds}::uuid[]))
      ORDER BY b.created_at DESC
      LIMIT 1
    `;

    if (existing && existing.length > 0) {
      const bill = existing[0] as unknown as CustomerBillRow;
      const linked = await sql`
        SELECT order_id::text, link_order
        FROM public.clearing_customer_bill_orders
        WHERE bill_id = ${bill.id}::uuid
        ORDER BY link_order ASC, created_at ASC
      `;
      const linkedIds = linked.map((row: any) => String(row.order_id));
      if (customerIds[0] && String(customerIds[0]) !== String(bill.customer_id)) {
        throw new Error("The selected customer orders do not belong to this bill's customer.");
      }
      const missingIds = orderIds.filter((id) => !linkedIds.includes(id));
      if (missingIds.length > 0 && bill.status !== "draft") {
        throw new Error("Only a draft customer bill can have its selected orders changed.");
      }
      if (missingIds.length > 0) {
        for (const id of missingIds) {
          await sql`
            INSERT INTO public.clearing_customer_bill_orders (bill_id, order_id, link_order)
            VALUES (${bill.id}::uuid, ${id}::uuid, ${linkedIds.length + 1})
            ON CONFLICT (bill_id, order_id) DO NOTHING
          `;
          linkedIds.push(id);
        }
        const orderNos = orders
          .filter((row: any) => linkedIds.includes(String(row.id)))
          .map((row: any) => row.order_no || row.id)
          .join(", ");
        await sql`
          UPDATE public.clearing_customer_bills
          SET order_no = ${orderNos}, updated_at = now()
          WHERE id = ${bill.id}::uuid
        `;
        bill.order_no = orderNos;
      }
      const linkedOrders = await sql`
        SELECT o.*
        FROM public.clearing_customer_bill_orders bo
        JOIN public.clearing_customer_orders o ON o.id = bo.order_id
        WHERE bo.bill_id = ${bill.id}::uuid AND o.deleted_at IS NULL
        ORDER BY bo.link_order ASC, bo.created_at ASC
      `;
      bill.order_ids = linkedOrders.map((row: any) => String(row.id));
      bill.orders = linkedOrders as unknown as Array<Record<string, any>>;
      bill.order = linkedOrders[0] ?? null;
      const items = await sql`
        SELECT * FROM public.clearing_customer_bill_items
        WHERE bill_id = ${bill.id}::uuid AND deleted_at IS NULL
        ORDER BY item_order ASC, created_at ASC
      `;
      bill.items = (items as unknown) as CustomerBillItemRow[];
      return bill;
    }

    const order = primaryOrder;

    // 3. Ensure Customer Shipping AR Ledger & Enterprise Account
    let customerAccountId: string | null = null;
    let customerAccountNumber: string | null = null;

    if (order.customer_id) {
      try {
        await ensureCustomerShippingLedger(
          order.customer_id,
          {
            countryId: order.country_id,
            countryBranchId: order.country_branch_id,
            cityBranchId: order.city_branch_id
          },
          actorId ?? null
        );

        const [ea] = await sql`
          SELECT id, code, account_number
          FROM public.enterprise_accounts
          WHERE customer_id = ${order.customer_id}::uuid
            AND operational_domain = 'shipping'
            AND deleted_at IS NULL
          LIMIT 1
        `;
        if (ea) {
          customerAccountId = ea.id;
          customerAccountNumber = ea.account_number || ea.code;
        }
      } catch (err) {
        console.warn("Could not ensure shipping AR ledger for customer order bill:", err);
      }
    }

    // 4. Generate Bill Number
    let billNo: string | null = null;
    try {
      const [seqRow] = await sql`
        SELECT public.next_entity_serial('global', 'GLOBAL', 'clearing_customer_bills', 'CB') AS serial
      `;
      billNo = seqRow?.serial ?? null;
    } catch {
      // Fallback if serial generator sequence is not initialized
      const year = new Date().getFullYear();
      const rand = Math.floor(1000 + Math.random() * 9000);
      billNo = `CB-${year}-${rand}`;
    }

    // 5. Insert Customer Bill Draft
    const [newBill] = await sql`
      INSERT INTO public.clearing_customer_bills (
        order_id,
        order_no,
        customer_id,
        customer_name,
        customer_account_id,
        customer_account_number,
        bill_no,
        bill_date,
        due_date,
        currency_code,
        transport_mode,
        movement_type,
        shipment_type,
        loading_port_name,
        destination_port_name,
        truck_number,
        subtotal,
        tax_amount,
        discount_amount,
        other_charges,
        grand_total,
        paid_amount,
        balance_due,
        status,
        super_admin_serial,
        country_serial,
        branch_serial,
        entry_serial,
        country_id,
        country_branch_id,
        city_branch_id,
        created_by
      ) VALUES (
        ${order.id}::uuid,
        ${order.order_no},
        ${order.customer_id}::uuid,
        ${order.customer_name},
        ${customerAccountId ? sql`${customerAccountId}::uuid` : null},
        ${customerAccountNumber},
        ${billNo},
        CURRENT_DATE,
        CURRENT_DATE + INTERVAL '15 days',
        'USD',
        ${order.transport_mode},
        ${order.movement_type},
        ${order.shipment_type},
        ${order.loading_port_name},
        ${order.destination_port_name},
        ${order.truck_number},
        0, 0, 0, 0, 0, 0, 0,
        'draft',
        ${order.super_admin_serial},
        ${order.country_serial},
        ${order.branch_serial},
        ${order.entry_serial},
        ${order.country_id ? sql`${order.country_id}::uuid` : null},
        ${order.country_branch_id ? sql`${order.country_branch_id}::uuid` : null},
        ${order.city_branch_id ? sql`${order.city_branch_id}::uuid` : null},
        ${actorId ? sql`${actorId}::uuid` : null}
      )
      RETURNING *
    `;

    await sql`
      INSERT INTO public.clearing_customer_bill_orders (bill_id, order_id, link_order)
      SELECT ${newBill.id}::uuid, value::uuid, ordinality::int
      FROM unnest(${orderIds}::uuid[]) WITH ORDINALITY AS selected(value, ordinality)
      ON CONFLICT (bill_id, order_id) DO NOTHING
    `;

    // 6. Prepopulate standard default charges template if empty
    const defaultLines = [
      { charge_type: "freight", charge_name: "Ocean / Road Freight", rate: 0, qty: 1 },
      { charge_type: "customs", charge_name: "Customs Clearance & Duty", rate: 0, qty: 1 },
      { charge_type: "port_charges", charge_name: "Port & Terminal Handling Charges", rate: 0, qty: 1 },
      { charge_type: "clearing", charge_name: "Clearing Agent Agency Fee", rate: 0, qty: 1 }
    ];

    const insertedItems: CustomerBillItemRow[] = [];
    for (let i = 0; i < defaultLines.length; i++) {
      const line = defaultLines[i];
      const [item] = await sql`
        INSERT INTO public.clearing_customer_bill_items (
          bill_id, item_order, charge_type, charge_name, quantity, rate, amount, tax_pct, tax_amount, total_amount
        ) VALUES (
          ${newBill.id}::uuid, ${i + 1}, ${line.charge_type}, ${line.charge_name},
          ${line.qty}, ${line.rate}, 0, 0, 0, 0
        )
        RETURNING *
      `;
      insertedItems.push(item as unknown as CustomerBillItemRow);
    }

    const res = newBill as unknown as CustomerBillRow;
    res.order_ids = orderIds;
    res.orders = orders as unknown as Array<Record<string, any>>;
    res.items = insertedItems;
    res.order = order;
    return res;
  });

  if (!result) throw new Error("Database connection not configured or operation failed.");
  return result;
}

export async function ensureCustomerBillForOrder(
  orderId: string,
  actorId?: string | null
): Promise<CustomerBillRow> {
  return ensureCustomerBillForOrders([orderId], actorId);
}

/**
 * Gets a Customer Bill by its ID, with items and related customer order data.
 */
export async function getCustomerBillById(billId: string): Promise<CustomerBillRow | null> {
  return await withLocalPg(async (sql) => {
    const [bill] = await sql`
      SELECT b.*,
             ea.name AS customer_account_name,
             p_sub.full_name AS submitted_by_name,
             p_app.full_name AS approved_by_name,
             p_post.full_name AS posted_by_name
      FROM public.clearing_customer_bills b
      LEFT JOIN public.enterprise_accounts ea ON ea.id = b.customer_account_id
      LEFT JOIN public.profiles p_sub ON p_sub.id = b.submitted_by
      LEFT JOIN public.profiles p_app ON p_app.id = b.approved_by
      LEFT JOIN public.profiles p_post ON p_post.id = b.posted_by
      WHERE b.id = ${billId}::uuid AND b.deleted_at IS NULL
      LIMIT 1
    `;
    if (!bill) return null;

    const items = await sql`
      SELECT * FROM public.clearing_customer_bill_items
      WHERE bill_id = ${bill.id}::uuid AND deleted_at IS NULL
      ORDER BY item_order ASC, created_at ASC
    `;

    const orders = await sql`
      SELECT o.*
      FROM public.clearing_customer_bill_orders bo
      JOIN public.clearing_customer_orders o ON o.id = bo.order_id
      WHERE bo.bill_id = ${bill.id}::uuid AND o.deleted_at IS NULL
      ORDER BY bo.link_order ASC, bo.created_at ASC
    `;
    const fallbackOrder = orders.length === 0
      ? await sql`SELECT * FROM public.clearing_customer_orders WHERE id = ${bill.order_id}::uuid LIMIT 1`
      : [];
    const allOrders = (orders.length > 0 ? orders : fallbackOrder) as unknown as Array<Record<string, any>>;
    const [order] = allOrders;

    const result = bill as unknown as CustomerBillRow;
    result.order_ids = allOrders.map((row: any) => String(row.id));
    result.orders = allOrders;
    result.items = (items as unknown) as CustomerBillItemRow[];
    result.order = order ?? null;
    return result;
  });
}

/**
 * Gets or ensures a Customer Bill by customer order ID.
 */
export async function getCustomerBillByOrderId(orderId: string): Promise<CustomerBillRow | null> {
  const result = await withLocalPg(async (sql) => {
    const [bill] = await sql`
      SELECT b.id
      FROM public.clearing_customer_bills b
      LEFT JOIN public.clearing_customer_bill_orders bo ON bo.bill_id = b.id
      WHERE b.deleted_at IS NULL
        AND (b.order_id = ${orderId}::uuid OR bo.order_id = ${orderId}::uuid)
      LIMIT 1
    `;
    if (bill) {
      return bill.id as string;
    }
    return null;
  });
  if (result) {
    return getCustomerBillById(result);
  }
  return null;
}

/**
 * Lists Customer Bills with filtering by search, customer, status, date.
 */
export async function listCustomerBills(filters?: {
  search?: string;
  customerId?: string;
  orderId?: string;
  status?: string;
  countryId?: string;
  countryIds?: string[] | null;
  countryBranchIds?: string[] | null;
  cityBranchIds?: string[] | null;
  clearingAgentIds?: string[] | null;
  createdByUserId?: string | null;
  isSuperAdmin?: boolean;
  limit?: number;
  offset?: number;
}): Promise<CustomerBillRow[]> {
  const result = await withLocalPg(async (sql) => {
    const search = filters?.search?.trim();
    const customerId = filters?.customerId?.trim();
    const orderId = filters?.orderId?.trim();
    const status = filters?.status?.trim();
    const limit = Math.min(filters?.limit ?? 50, 100);
    const offset = filters?.offset ?? 0;
    // Bills inherit scope from their linked customer orders. Use the same
    // narrowest-scope precedence as the order service instead of OR-ing every
    // session dimension, which could expose a record from another country or
    // branch merely because the creator id matched.
    let scopeCondition = sql`false`;
    if (filters?.isSuperAdmin) {
      scopeCondition = sql`true`;
    } else if (filters?.clearingAgentIds && filters.clearingAgentIds.length > 0) {
      scopeCondition = sql`EXISTS (
        SELECT 1
        FROM public.clearing_customer_bill_orders bo_scope
        JOIN public.clearing_customer_orders co_scope ON co_scope.id = bo_scope.order_id
        WHERE bo_scope.bill_id = b.id
          AND co_scope.deleted_at IS NULL
          AND co_scope.clearing_agent_id = ANY(${filters.clearingAgentIds}::uuid[])
      )`;
    } else if (filters?.cityBranchIds && filters.cityBranchIds.length > 0) {
      scopeCondition = sql`EXISTS (
        SELECT 1
        FROM public.clearing_customer_bill_orders bo_scope
        JOIN public.clearing_customer_orders co_scope ON co_scope.id = bo_scope.order_id
        WHERE bo_scope.bill_id = b.id
          AND co_scope.deleted_at IS NULL
          AND co_scope.city_branch_id = ANY(${filters.cityBranchIds}::uuid[])
      )`;
    } else if (filters?.countryBranchIds && filters.countryBranchIds.length > 0) {
      scopeCondition = sql`EXISTS (
        SELECT 1
        FROM public.clearing_customer_bill_orders bo_scope
        JOIN public.clearing_customer_orders co_scope ON co_scope.id = bo_scope.order_id
        WHERE bo_scope.bill_id = b.id
          AND co_scope.deleted_at IS NULL
          AND co_scope.country_branch_id = ANY(${filters.countryBranchIds}::uuid[])
      )`;
    } else if (filters?.countryIds && filters.countryIds.length > 0) {
      scopeCondition = sql`EXISTS (
        SELECT 1
        FROM public.clearing_customer_bill_orders bo_scope
        JOIN public.clearing_customer_orders co_scope ON co_scope.id = bo_scope.order_id
        WHERE bo_scope.bill_id = b.id
          AND co_scope.deleted_at IS NULL
          AND co_scope.country_id = ANY(${filters.countryIds}::uuid[])
      )`;
    } else if (filters?.createdByUserId) {
      scopeCondition = sql`b.created_by = ${filters.createdByUserId}::uuid`;
    }

    const rows = await sql`
      SELECT b.*,
             c.customer_name AS customer_company_name,
             ea.name AS account_name
      FROM public.clearing_customer_bills b
      LEFT JOIN public.customers c ON c.id = b.customer_id
      LEFT JOIN public.enterprise_accounts ea ON ea.id = b.customer_account_id
      WHERE b.deleted_at IS NULL
        AND ${scopeCondition}
        ${orderId ? sql`AND b.order_id = ${orderId}::uuid` : sql``}
        ${customerId ? sql`AND b.customer_id = ${customerId}::uuid` : sql``}
        ${status && status !== "all" ? sql`AND b.status = ${status}` : sql``}
        ${
          search
            ? sql`AND (
                b.bill_no ILIKE ${`%${search}%`}
                OR b.order_no ILIKE ${`%${search}%`}
                OR b.customer_name ILIKE ${`%${search}%`}
                OR b.truck_number ILIKE ${`%${search}%`}
              )`
            : sql``
        }
      ORDER BY b.created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;

    return (rows as unknown) as CustomerBillRow[];
  });

  return result ?? [];
}

/**
 * Saves and recalculates line items and totals for a customer bill.
 */
export async function saveCustomerBill(input: CustomerBillSaveInput): Promise<CustomerBillRow> {
  const result = await withLocalPg(async (sql) => {
    const billId = input.id;
    const now = new Date().toISOString();

    const [existing] = await sql`
      SELECT * FROM public.clearing_customer_bills
      WHERE id = ${billId}::uuid AND deleted_at IS NULL
      LIMIT 1
    `;
    if (!existing) throw new Error("Customer bill not found.");
    if (existing.status === "posted") throw new Error("Cannot modify a posted customer bill.");

    const requestedOrderIds = input.orderIds ? normalizeOrderIds(input.orderIds) : [];
    if (input.orderIds && requestedOrderIds.length === 0) {
      throw new Error("At least one customer order is required.");
    }
    if (requestedOrderIds.length > 0) {
      const selectedOrders = await sql`
        SELECT id, order_no, customer_id
        FROM public.clearing_customer_orders
        WHERE id = ANY(${requestedOrderIds}::uuid[]) AND deleted_at IS NULL
        ORDER BY array_position(${requestedOrderIds}::uuid[], id)
      `;
      if (selectedOrders.length !== requestedOrderIds.length) {
        throw new Error("One or more selected customer orders are no longer available.");
      }
      const customerIds = Array.from(new Set(selectedOrders.map((row: any) => row.customer_id).filter(Boolean)));
      if (customerIds.length > 1 || (customerIds[0] && String(customerIds[0]) !== String(existing.customer_id))) {
        throw new Error("A customer bill can only include orders for its customer.");
      }
      await sql`DELETE FROM public.clearing_customer_bill_orders WHERE bill_id = ${billId}::uuid`;
      for (let index = 0; index < selectedOrders.length; index += 1) {
        await sql`
          INSERT INTO public.clearing_customer_bill_orders (bill_id, order_id, link_order)
          VALUES (${billId}::uuid, ${selectedOrders[index].id}::uuid, ${index + 1})
          ON CONFLICT (bill_id, order_id) DO UPDATE SET link_order = EXCLUDED.link_order
        `;
      }
    }

    // Recalculate line items
    let subtotal = 0;
    let totalTax = 0;

    // Delete existing items and insert new ones cleanly
    await sql`
      DELETE FROM public.clearing_customer_bill_items
      WHERE bill_id = ${billId}::uuid
    `;

    const insertedItems: CustomerBillItemRow[] = [];
    for (let i = 0; i < input.items.length; i++) {
      const item = input.items[i];
      const qty = Math.max(Number(item.quantity) || 1, 0);
      const rate = Math.max(Number(item.rate) || 0, 0);
      const amt = Number((qty * rate).toFixed(4));
      const taxPct = Math.max(Number(item.tax_pct) || 0, 0);
      const taxAmt = Number(((amt * taxPct) / 100).toFixed(4));
      const totalAmt = Number((amt + taxAmt).toFixed(4));

      subtotal += amt;
      totalTax += taxAmt;

      const [newItem] = await sql`
        INSERT INTO public.clearing_customer_bill_items (
          bill_id, item_order, charge_type, charge_name, description,
          quantity, unit, rate, amount, tax_pct, tax_amount, total_amount, remarks,
          created_at, updated_at
        ) VALUES (
          ${billId}::uuid, ${i + 1}, ${item.charge_type || "other"},
          ${item.charge_name || "Charge"}, ${item.description ?? null},
          ${qty}, ${item.unit || "unit"}, ${rate}, ${amt}, ${taxPct}, ${taxAmt}, ${totalAmt},
          ${item.remarks ?? null}, ${now}, ${now}
        )
        RETURNING *
      `;
      insertedItems.push(newItem as unknown as CustomerBillItemRow);
    }

    const discount = Math.max(Number(input.discountAmount) || 0, 0);
    const otherCharges = Math.max(Number(input.otherCharges) || 0, 0);
    const grandTotal = Number((subtotal + totalTax + otherCharges - discount).toFixed(4));
    const paidAmount = Number(existing.paid_amount) || 0;
    const balanceDue = Number((grandTotal - paidAmount).toFixed(4));

    const [updatedBill] = await sql`
      UPDATE public.clearing_customer_bills
      SET
        subtotal = ${subtotal},
        tax_amount = ${totalTax},
        discount_amount = ${discount},
        other_charges = ${otherCharges},
        grand_total = ${grandTotal},
        balance_due = ${balanceDue},
        due_date = ${input.dueDate ? sql`${input.dueDate}::date` : sql`due_date`},
        remarks = ${input.remarks !== undefined ? input.remarks : sql`remarks`},
        order_id = ${requestedOrderIds.length > 0 ? sql`${requestedOrderIds[0]}::uuid` : sql`order_id`},
        order_no = ${requestedOrderIds.length > 0
          ? sql`(SELECT string_agg(COALESCE(order_no, id::text), ', ' ORDER BY array_position(${requestedOrderIds}::uuid[], id)) FROM public.clearing_customer_orders WHERE id = ANY(${requestedOrderIds}::uuid[]))`
          : sql`order_no`},
        updated_at = ${now}
      WHERE id = ${billId}::uuid
      RETURNING *
    `;

    const res = updatedBill as unknown as CustomerBillRow;
    if (requestedOrderIds.length > 0) res.order_ids = requestedOrderIds;
    res.items = insertedItems;
    return res;
  });

  if (!result) throw new Error("Database connection not configured or save failed.");
  return result;
}

/**
 * Submits bill for supervisor / finance approval.
 */
export async function submitCustomerBill(billId: string, actorId: string): Promise<CustomerBillRow> {
  const result = await withLocalPg(async (sql) => {
    const [bill] = await sql`
      UPDATE public.clearing_customer_bills
      SET status = 'submitted',
          submitted_by = ${actorId}::uuid,
          submitted_at = now(),
          updated_at = now()
      WHERE id = ${billId}::uuid AND status = 'draft'
      RETURNING *
    `;
    if (!bill) throw new Error("Bill not found or cannot be submitted.");
    return bill as unknown as CustomerBillRow;
  });

  if (!result) throw new Error("Database connection not configured or submit failed.");
  return result;
}

/**
 * Approves bill.
 */
export async function approveCustomerBill(billId: string, actorId: string): Promise<CustomerBillRow> {
  const result = await withLocalPg(async (sql) => {
    const [bill] = await sql`
      UPDATE public.clearing_customer_bills
      SET status = 'approved',
          approved_by = ${actorId}::uuid,
          approved_at = now(),
          updated_at = now()
      WHERE id = ${billId}::uuid AND status IN ('draft', 'submitted')
      RETURNING *
    `;
    if (!bill) throw new Error("Bill not found or already approved/posted.");
    return bill as unknown as CustomerBillRow;
  });

  if (!result) throw new Error("Database connection not configured or approve failed.");
  return result;
}

/**
 * Posts approved Customer Bill to Roznamcha / Customer AR Ledger.
 * DR: Customer Shipping AR
 * CR: Shipping & Clearing Revenue
 */
export async function postCustomerBillToLedger(
  billId: string,
  actorId: string
): Promise<{ bill: CustomerBillRow; entryId: string }> {
  const bill = await getCustomerBillById(billId);
  if (!bill) throw new Error("Customer bill not found.");
  if (bill.status === "posted") throw new Error("This bill is already posted to the General Ledger.");
  if (Number(bill.grand_total) <= 0) {
    throw new Error("Cannot post a bill with zero grand total.");
  }

  // 1. Ensure Customer Shipping AR Ledger
  const scope = {
    countryId: bill.country_id,
    countryBranchId: bill.country_branch_id,
    cityBranchId: bill.city_branch_id
  };
  const customerLedgerId = await ensureCustomerShippingLedger(bill.customer_id, scope, actorId);
  const revenueLedgerId = await ensureShippingRevenueLedger(actorId);

  const entryDate = bill.bill_date ? String(bill.bill_date).slice(0, 10) : new Date().toISOString().slice(0, 10);
  const billRef = bill.bill_no;
  const uniq = Date.now().toString(36).toUpperCase().slice(-4);
  const journalNo = `JRN-${billRef}-${uniq}`.slice(0, 118);
  const voucherNo = `VCH-${billRef}-${uniq}`.slice(0, 118);

  const amount = Number(bill.grand_total);
  const narration = `Customer Bill ${billRef} for Order ${bill.order_no ?? "—"} (${bill.customer_name ?? "Customer"})`;

  // 2. Post to Roznamcha via existing financial engine
  const { entryId } = await postRoznamchaWithErpSession({
    sessionUserId: actorId,
    body: {
      mode: "post",
      type: "super_admin",
      entryDate,
      journalNo,
      voucherNo,
      narration,
      referenceNo: billRef,
      roznamchaCategory: "shipping",
      sourceModule: "clearing_customer_bills",
      sourceTransactionType: "customer_bill",
      sourceTransactionId: bill.id,
      lines: [
        {
          ledgerId: customerLedgerId,
          debit: amount,
          credit: 0,
          currency: bill.currency_code || "USD",
          exchangeRate: 1,
          description: `Customer AR: Bill ${billRef}`,
          paymentEntryType: "debit"
        },
        {
          ledgerId: revenueLedgerId,
          debit: 0,
          credit: amount,
          currency: bill.currency_code || "USD",
          exchangeRate: 1,
          description: `Shipping Revenue: Bill ${billRef}`,
          paymentEntryType: "credit"
        }
      ]
    } as never
  });

  // 3. Update Bill status and roznamcha_entry_id
  const updatedBill = await withLocalPg(async (sql) => {
    const [res] = await sql`
      UPDATE public.clearing_customer_bills
      SET status = 'posted',
          posted_by = ${actorId}::uuid,
          posted_at = now(),
          roznamcha_entry_id = ${entryId}::uuid,
          updated_at = now()
      WHERE id = ${billId}::uuid
      RETURNING *
    `;
    return res as unknown as CustomerBillRow;
  });

  if (!updatedBill) throw new Error("Failed to update bill after posting.");

  return { bill: updatedBill, entryId };
}

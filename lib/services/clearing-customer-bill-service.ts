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

/**
 * Ensures a Customer Bill draft exists for the given customer order.
 * If already existing, returns it.
 * If not, automatically creates a new draft inheriting customer account,
 * order reference, branch scope, serials, and shipment metadata.
 */
export async function ensureCustomerBillForOrder(
  orderId: string,
  actorId?: string | null
): Promise<CustomerBillRow> {
  const result = await withLocalPg(async (sql) => {
    // 1. Check if bill already exists
    const existing = await sql`
      SELECT * FROM public.clearing_customer_bills
      WHERE order_id = ${orderId}::uuid AND deleted_at IS NULL
      LIMIT 1
    `;

    if (existing && existing.length > 0) {
      const bill = existing[0] as unknown as CustomerBillRow;
      const items = await sql`
        SELECT * FROM public.clearing_customer_bill_items
        WHERE bill_id = ${bill.id}::uuid AND deleted_at IS NULL
        ORDER BY item_order ASC, created_at ASC
      `;
      bill.items = (items as unknown) as CustomerBillItemRow[];
      return bill;
    }

    // 2. Fetch Customer Order details
    const [order] = await sql`
      SELECT * FROM public.clearing_customer_orders
      WHERE id = ${orderId}::uuid AND deleted_at IS NULL
      LIMIT 1
    `;
    if (!order) {
      throw new Error(`Customer order ${orderId} not found.`);
    }

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
    res.items = insertedItems;
    res.order = order;
    return res;
  });

  if (!result) throw new Error("Database connection not configured or operation failed.");
  return result;
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

    const [order] = await sql`
      SELECT * FROM public.clearing_customer_orders
      WHERE id = ${bill.order_id}::uuid
      LIMIT 1
    `;

    const result = bill as unknown as CustomerBillRow;
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
      SELECT id FROM public.clearing_customer_bills
      WHERE order_id = ${orderId}::uuid AND deleted_at IS NULL
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

    const rows = await sql`
      SELECT b.*,
             c.customer_name AS customer_company_name,
             ea.name AS account_name
      FROM public.clearing_customer_bills b
      LEFT JOIN public.customers c ON c.id = b.customer_id
      LEFT JOIN public.enterprise_accounts ea ON ea.id = b.customer_account_id
      WHERE b.deleted_at IS NULL
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
        updated_at = ${now}
      WHERE id = ${billId}::uuid
      RETURNING *
    `;

    const res = updatedBill as unknown as CustomerBillRow;
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

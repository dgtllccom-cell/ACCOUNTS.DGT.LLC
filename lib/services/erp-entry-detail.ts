/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Reusable ERP "All Release Entries" detail resolver.
 *
 * Given a record id + its source type, returns a NORMALIZED detail shape that one generic detail
 * component can render for every ERP source. REAL saved data only — every value comes from the
 * actual record. Party/Bank relations are surfaced ONLY when they resolve through a genuine saved
 * foreign key / verified relationship; otherwise an honest "no verified relation" state is returned.
 * Nothing is guessed, inferred, or fuzzy-matched.
 *
 * Field labels are emitted as (i18nKey, fallback) pairs so the client translates them reactively in
 * all five languages — this module never returns translated chrome, only data + label keys.
 */

export type DetailField = { key: string; label: string; value: string; strong?: boolean };
export type PartyCard = { linked: boolean; titleKey: string; titleLabel: string; fields: DetailField[]; noteKey?: string; noteLabel?: string; viaKey?: string; viaLabel?: string; via?: string };
export type LinesBlock = {
  columns: Array<{ key: string; label: string; num?: boolean }>;
  rows: Array<Record<string, string>>;
  totals?: Record<string, string>;
};
export type Detail = {
  found: boolean;
  module: string;
  moduleLabel: string;
  header: { entryNo: string; status: string; subtitle: string };
  origin: { country: string; branch: string; sourceModule: string; recordId: string };
  general: DetailField[];
  party: PartyCard | null;
  bank: PartyCard | null;
  amounts: Array<{ key: string; label: string; value: string; tone?: string }> | null;
  lines: LinesBlock | null;
  workflow: { statusKey: string; statusLabel: string; status: string; steps: DetailField[] } | null;
  audit: Array<{ actor: string; action: string; at: string }>;
  attachments: Array<{ name: string; mime: string; size: number; at: string }>;
};

const num = (n: any) => Number(n || 0);
const money = (n: any) => Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const f = (key: string, label: string, value: any, strong = false): DetailField => ({ key, label, value: value == null || value === "" ? "-" : String(value), strong });
const has = (v: any) => v != null && String(v).trim() !== "" && String(v) !== "-";

/** Which resolver handles a given feed row (module + sourceModule). */
export function resolverFor(module: string, src: string): string {
  if (src === "Roznamcha") return "roznamcha";
  if (src === "Purchase") return "purchase";
  if (src === "Sales") return "sales";
  if (src === "Master") return module.toLowerCase();
  return "roznamcha";
}

async function attachmentsFor(sql: any, table: string, id: string) {
  const rows = await sql`
    select path, mime_type, size_bytes, created_at
    from attachments where owner_table = ${table} and owner_id = ${id} and deleted_at is null
    order by created_at asc`;
  return (rows as any[]).map((a) => ({ name: String(a.path || "").split("/").pop() || a.path, mime: a.mime_type || "", size: num(a.size_bytes), at: a.created_at }));
}
async function auditFor(sql: any, table: string, id: string) {
  const rows = await sql`
    select a.action, a.created_at, ap.full_name actor
    from audit_logs a left join profiles ap on ap.id = a.actor_id
    where a.entity_table = ${table} and a.entity_id = ${id} order by a.created_at asc limit 100`;
  return (rows as any[]).map((a) => ({ actor: a.actor || "", action: a.action || "Updated", at: a.created_at }));
}

// ------------------------------------------------------------------ Roznamcha
async function roznamcha(sql: any, id: string): Promise<Detail | null> {
  const [e] = await sql`
    select e.id::text, e.voucher_no, e.journal_no, e.reference_no, e.source_reference_no, e.narration,
      e.type::text, e.entry_category, e.source_module, e.source_transaction_type, e.status::text,
      e.entry_date, e.created_at, e.approved_at, e.posted_at,
      cp.full_name created_by, ap.full_name approved_by,
      co.name country_name, coalesce(cib.name, cb.name) branch_name
    from roznamcha_entries e
    left join profiles cp on cp.id = e.created_by
    left join profiles ap on ap.id = e.approved_by
    left join countries co on co.id = e.country_id
    left join city_branches cib on cib.id = e.city_branch_id
    left join country_branches cb on cb.id = e.country_branch_id
    where e.id = ${id} and e.deleted_at is null`;
  if (!e) return null;

  const lines = await sql`
    select l.account_number, l.customer_number, l.description, l.debit::numeric, l.credit::numeric,
      l.currency, l.usd_rate::numeric, l.usd_amount::numeric, l.enterprise_account_id,
      lg.name ledger_name, lg.code ledger_code
    from roznamcha_lines l left join ledgers lg on lg.id = l.ledger_id
    where l.roznamcha_entry_id = ${id} order by l.debit desc nulls last`;

  // Verified party/bank via the enterprise_account_id -> enterprise_accounts FK chain (customer_id/company_id/bank_id).
  const eaIds = [...new Set((lines as any[]).map((l) => l.enterprise_account_id).filter(Boolean))];
  let partyRow: any = null; let bankRow: any = null;
  if (eaIds.length) {
    const resolved = await sql`
      select ea.code, ea.name ea_name, ea.customer_id, ea.company_id, ea.bank_id,
        cu.customer_name, cu.mobile cust_mobile, cu.email cust_email, cu.address cust_address,
        co.name company_name, co.owner_name company_owner,
        bk.bank_name, bk.account_title, bk.account_number bank_acct, bk.iban_number bank_iban, bk.currency bank_currency
      from enterprise_accounts ea
      left join customers cu on cu.id = ea.customer_id
      left join companies co on co.id = ea.company_id
      left join banks bk on bk.id = ea.bank_id
      where ea.id = any(${eaIds}) and (ea.customer_id is not null or ea.company_id is not null or ea.bank_id is not null)
      limit 5`;
    for (const r of resolved as any[]) {
      if (!partyRow && (r.customer_id || r.company_id)) partyRow = r;
      if (!bankRow && r.bank_id) bankRow = r;
    }
  }

  const totalDebit = (lines as any[]).reduce((s, l) => s + num(l.debit), 0);
  const totalCredit = (lines as any[]).reduce((s, l) => s + num(l.credit), 0);
  const totalUsd = (lines as any[]).reduce((s, l) => s + num(l.usd_amount), 0);
  const currency = (lines as any[]).find((l) => has(l.currency))?.currency || "";
  const usdRate = num((lines as any[]).find((l) => num(l.usd_rate))?.usd_rate);

  const lifecycle: Detail["audit"] = [];
  if (e.created_at) lifecycle.push({ action: "Created", actor: e.created_by || "", at: e.created_at });
  if (e.approved_at) lifecycle.push({ action: "Approved", actor: e.approved_by || "", at: e.approved_at });
  if (e.posted_at) lifecycle.push({ action: "Posted", actor: e.created_by || "", at: e.posted_at });
  (await auditFor(sql, "roznamcha_entries", id)).forEach((a) => lifecycle.push(a));
  lifecycle.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());

  const party: PartyCard = partyRow
    ? {
        linked: true, titleKey: "sed.sec_party", titleLabel: "Party / Customer / Supplier",
        viaKey: "sed.linked_via", viaLabel: "Linked via", via: partyRow.code || partyRow.ea_name || "",
        fields: partyRow.customer_id
          ? [f("acct.customer_name", "Customer", partyRow.customer_name), f("sed.f_mobile", "Mobile", partyRow.cust_mobile), f("sed.f_email", "Email", partyRow.cust_email), f("sed.f_address", "Address", partyRow.cust_address)]
          : [f("acct.company_name", "Company", partyRow.company_name), f("sed.f_owner_name", "Owner Name", partyRow.company_owner)]
      }
    : { linked: false, titleKey: "sed.sec_party", titleLabel: "Party / Customer / Supplier", noteKey: "sed.state_no_customer", noteLabel: "No verified customer relation", fields: [] };

  const bank: PartyCard = bankRow
    ? {
        linked: true, titleKey: "sed.sec_bank", titleLabel: "Bank / Account",
        viaKey: "sed.linked_via", viaLabel: "Linked via", via: bankRow.code || "",
        fields: [f("sed.f_bank_name", "Bank Name", bankRow.bank_name), f("sed.f_account_title", "Account Title", bankRow.account_title), f("sed.f_account_number", "Account Number", bankRow.bank_acct), f("sed.f_iban", "IBAN", bankRow.bank_iban)]
      }
    : { linked: false, titleKey: "sed.sec_bank", titleLabel: "Bank / Account", noteKey: "sed.state_no_bank", noteLabel: "No verified bank relation", fields: [] };

  return {
    found: true, module: "Roznamcha", moduleLabel: e.source_transaction_type || e.type || "Roznamcha",
    header: { entryNo: e.voucher_no || e.journal_no || e.reference_no || e.id.slice(0, 8), status: e.status || "", subtitle: e.narration || e.source_transaction_type || "" },
    origin: { country: e.country_name || "", branch: e.branch_name || "", sourceModule: e.source_module || "Roznamcha", recordId: e.id },
    general: [
      f("bankroz.entry_no", "Entry No", e.voucher_no || e.journal_no || e.reference_no),
      f("sed.voucher_no", "Voucher No", e.voucher_no),
      f("sed.journal_no", "Journal No", e.journal_no),
      f("rozrep.date", "Date", e.entry_date),
      f("sed.entry_type", "Entry Type", e.source_transaction_type || e.type),
      f("sed.f_category", "Category", e.entry_category),
      f("acct.reference_no", "Reference No", e.reference_no || e.source_reference_no),
      f("rozrep.currency", "Currency", currency),
      f("sed.exchange_rate", "Exchange Rate", usdRate ? `1 ${currency} = ${usdRate} USD` : ""),
      f("acct.status", "Status", e.status),
      f("acct.created_by", "Created By", e.created_by),
      f("vch.approved_by", "Approved By", e.approved_by)
    ],
    party, bank,
    amounts: [
      { key: "bankroz.total_debit", label: "Total Debit", value: money(totalDebit) + (currency ? " " + currency : ""), tone: "debit" },
      { key: "bankroz.total_credit", label: "Total Credit", value: money(totalCredit) + (currency ? " " + currency : ""), tone: "credit" },
      { key: "sed.total_usd", label: "Total (USD)", value: money(totalUsd) + " USD" },
      { key: "sed.net_balance", label: "Net Balance", value: money(totalDebit - totalCredit) + (currency ? " " + currency : "") }
    ],
    lines: {
      columns: [
        { key: "code", label: "Account Code" }, { key: "name", label: "Account Name" }, { key: "desc", label: "Description" },
        { key: "debit", label: "Debit", num: true }, { key: "credit", label: "Credit", num: true }, { key: "usd", label: "USD", num: true }
      ],
      rows: (lines as any[]).map((l) => ({
        code: l.account_number || l.ledger_code || "-", name: l.ledger_name || l.account_number || "-", desc: l.description || "-",
        debit: num(l.debit) ? money(l.debit) : "-", credit: num(l.credit) ? money(l.credit) : "-", usd: num(l.usd_amount) ? money(l.usd_amount) : "-"
      })),
      totals: { debit: money(totalDebit), credit: money(totalCredit), usd: money(totalUsd) }
    },
    workflow: { statusKey: "acct.status", statusLabel: "Status", status: e.status || "", steps: [
      f("sed.f_posting_status", "Ledger Posting Status", e.posted_at ? "Posted" : "Pending"),
      f("sed.posting_date", "Posting Date", e.posted_at),
      f("sed.approved_date", "Approved Date", e.approved_at)
    ] },
    audit: lifecycle,
    attachments: await attachmentsFor(sql, "roznamcha_entries", id)
  };
}

// ------------------------------------------------------------------ Purchase Order
async function purchase(sql: any, id: string): Promise<Detail | null> {
  const [po] = await sql`
    select po.id::text, po.purchase_order_no, po.purchase_contract_no, po.supplier_company_id,
      po.currency_code, po.exchange_rate::numeric, po.order_total::numeric, po.advance_paid::numeric,
      po.remaining_paid::numeric, po.credit_amount::numeric, po.remaining_due::numeric,
      po.payment_status::text, po.ledger_posting_status::text, po.status::text,
      po.total_goods_local::numeric, po.total_expenses_local::numeric, po.landed_cost_local::numeric,
      po.total_goods_usd::numeric, po.landed_cost_usd::numeric, po.created_at,
      cp.full_name created_by, co.name country_name, coalesce(cib.name, cb.name) branch_name,
      comp.name supplier_name, comp.legal_name supplier_legal, comp.owner_name supplier_owner, comp.business_type supplier_biz
    from purchase_orders po
    left join profiles cp on cp.id = po.created_by
    left join countries co on co.id = po.country_id
    left join city_branches cib on cib.id = po.city_branch_id
    left join country_branches cb on cb.id = po.country_branch_id
    left join companies comp on comp.id = po.supplier_company_id
    where po.id = ${id} and po.deleted_at is null`;
  if (!po) return null;

  const cur = po.currency_code || "";
  const party: PartyCard = po.supplier_company_id && has(po.supplier_name)
    ? { linked: true, titleKey: "sed.sec_party", titleLabel: "Supplier", viaKey: "sed.linked_via", viaLabel: "Linked via", via: "supplier_company_id",
        fields: [f("sed.f_supplier", "Supplier", po.supplier_name), f("sed.f_legal_name", "Legal Name", po.supplier_legal), f("sed.f_owner_name", "Owner Name", po.supplier_owner), f("sed.f_business_type", "Business Type", po.supplier_biz)] }
    : { linked: false, titleKey: "sed.sec_party", titleLabel: "Supplier", noteKey: "sed.state_no_supplier", noteLabel: "No verified supplier relation", fields: [] };

  return {
    found: true, module: "Purchase", moduleLabel: "Purchase Order",
    header: { entryNo: po.purchase_order_no || po.id.slice(0, 8), status: po.status || po.payment_status || "", subtitle: po.purchase_contract_no || "" },
    origin: { country: po.country_name || "", branch: po.branch_name || "", sourceModule: "Purchase", recordId: po.id },
    general: [
      f("sed.f_po_no", "Purchase Order No", po.purchase_order_no),
      f("sed.f_contract_no", "Contract No", po.purchase_contract_no),
      f("rozrep.date", "Date", po.created_at),
      f("rozrep.currency", "Currency", cur),
      f("sed.exchange_rate", "Exchange Rate", po.exchange_rate ? `1 ${cur} = ${num(po.exchange_rate)} USD` : ""),
      f("acct.status", "Status", po.status),
      f("acct.created_by", "Created By", po.created_by)
    ],
    party, bank: null,
    amounts: [
      { key: "sed.f_order_total", label: "Order Total", value: money(po.order_total) + (cur ? " " + cur : ""), tone: "debit" },
      { key: "sed.f_advance_paid", label: "Advance Paid", value: money(po.advance_paid) + (cur ? " " + cur : ""), tone: "credit" },
      { key: "sed.f_remaining_due", label: "Remaining Due", value: money(po.remaining_due) + (cur ? " " + cur : ""), tone: "open" },
      { key: "sed.f_landed_cost", label: "Landed Cost", value: money(po.landed_cost_local) + (cur ? " " + cur : "") }
    ],
    lines: null,
    workflow: { statusKey: "sed.f_payment_status", statusLabel: "Payment Status", status: po.payment_status || "", steps: [
      f("sed.f_payment_status", "Payment Status", po.payment_status),
      f("sed.f_posting_status", "Ledger Posting Status", po.ledger_posting_status),
      f("sed.f_advance_paid", "Advance Paid", money(po.advance_paid) + (cur ? " " + cur : "")),
      f("sed.f_credit_amount", "Credit Amount", money(po.credit_amount) + (cur ? " " + cur : "")),
      f("sed.f_remaining_due", "Remaining Due", money(po.remaining_due) + (cur ? " " + cur : "")),
      f("sed.f_goods_total", "Goods Total", money(po.total_goods_local) + (cur ? " " + cur : "")),
      f("sed.f_expenses_total", "Expenses Total", money(po.total_expenses_local) + (cur ? " " + cur : "")),
      f("sed.f_final_amount", "Final Amount (USD)", money(po.landed_cost_usd) + " USD", true)
    ] },
    audit: await auditFor(sql, "purchase_orders", id),
    attachments: await attachmentsFor(sql, "purchase_orders", id)
  };
}

// ------------------------------------------------------------------ Sales Order
async function sales(sql: any, id: string): Promise<Detail | null> {
  const [so] = await sql`
    select so.id::text, so.sales_order_no, so.sales_contract_no, so.order_date, so.customer_name,
      so.customer_account_id, so.customer_ledger_id, so.customer_number, so.account_number,
      so.currency_code, so.exchange_rate::numeric, so.order_total::numeric, so.paid_amount::numeric,
      so.remaining_amount::numeric, so.sales_status::text, so.payment_status::text, so.delivery_status::text,
      so.workflow_state, so.created_at,
      cp.full_name created_by, co.name country_name, coalesce(cib.name, cb.name) branch_name,
      ea.id ea_id, ea.name ea_name, ea.customer_id ea_customer_id, cu.customer_name linked_customer,
      cu.mobile cust_mobile, cu.email cust_email
    from sales_orders so
    left join profiles cp on cp.id = so.created_by
    left join countries co on co.id = so.country_id
    left join city_branches cib on cib.id = so.city_branch_id
    left join country_branches cb on cb.id = so.country_branch_id
    left join enterprise_accounts ea on ea.id = so.customer_account_id
    left join customers cu on cu.id = ea.customer_id
    where so.id = ${id} and so.deleted_at is null`;
  if (!so) return null;

  const cur = so.currency_code || "";
  // Verified customer ONLY via customer_account_id -> enterprise_accounts -> customers. customer_name alone is an unverified string.
  const party: PartyCard = so.ea_customer_id && has(so.linked_customer)
    ? { linked: true, titleKey: "sed.sec_party", titleLabel: "Customer", viaKey: "sed.linked_via", viaLabel: "Linked via", via: "customer_account_id",
        fields: [f("sed.f_customer", "Customer", so.linked_customer), f("sed.f_mobile", "Mobile", so.cust_mobile), f("sed.f_email", "Email", so.cust_email)] }
    : { linked: false, titleKey: "sed.sec_party", titleLabel: "Customer", noteKey: "sed.state_no_customer", noteLabel: "No verified customer relation",
        fields: has(so.customer_name) ? [f("sed.f_customer", "Customer (unverified name)", so.customer_name)] : [] };

  return {
    found: true, module: "Sale", moduleLabel: "Sales Order",
    header: { entryNo: so.sales_order_no || so.id.slice(0, 8), status: so.sales_status || so.payment_status || "", subtitle: so.sales_contract_no || "" },
    origin: { country: so.country_name || "", branch: so.branch_name || "", sourceModule: "Sales", recordId: so.id },
    general: [
      f("sed.f_so_no", "Sales Order No", so.sales_order_no),
      f("sed.f_contract_no", "Contract No", so.sales_contract_no),
      f("sed.f_order_date", "Order Date", so.order_date || so.created_at),
      f("rozrep.currency", "Currency", cur),
      f("sed.exchange_rate", "Exchange Rate", so.exchange_rate ? `1 ${cur} = ${num(so.exchange_rate)} USD` : ""),
      f("acct.status", "Status", so.sales_status),
      f("acct.created_by", "Created By", so.created_by)
    ],
    party, bank: null,
    amounts: [
      { key: "sed.f_order_total", label: "Order Total", value: money(so.order_total) + (cur ? " " + cur : ""), tone: "debit" },
      { key: "sed.f_paid_amount", label: "Paid Amount", value: money(so.paid_amount) + (cur ? " " + cur : ""), tone: "credit" },
      { key: "sed.f_remaining", label: "Remaining", value: money(so.remaining_amount) + (cur ? " " + cur : ""), tone: "open" }
    ],
    lines: null,
    workflow: { statusKey: "sed.f_sales_status", statusLabel: "Sales Status", status: so.sales_status || "", steps: [
      f("sed.f_sales_status", "Sales Status", so.sales_status),
      f("sed.f_payment_status", "Payment Status", so.payment_status),
      f("sed.f_delivery_status", "Delivery Status", so.delivery_status),
      f("sed.f_workflow_state", "Workflow State", so.workflow_state)
    ] },
    audit: await auditFor(sql, "sales_orders", id),
    attachments: await attachmentsFor(sql, "sales_orders", id)
  };
}

// ------------------------------------------------------------------ Masters
async function master(sql: any, id: string, kind: string): Promise<Detail | null> {
  const base = (row: any, entryNo: string, status: string, subtitle: string, general: DetailField[], countryName = "", branchName = ""): Detail => ({
    found: true, module: kind[0].toUpperCase() + kind.slice(1), moduleLabel: kind[0].toUpperCase() + kind.slice(1),
    header: { entryNo, status, subtitle },
    origin: { country: countryName, branch: branchName, sourceModule: "Master", recordId: id },
    general, party: null, bank: null, amounts: null, lines: null, workflow: null,
    audit: [], attachments: []
  });

  if (kind === "customer") {
    const [r] = await sql`select c.*, co.name country_name from customers c left join countries co on co.id=c.country_id where c.id=${id} and c.deleted_at is null`;
    if (!r) return null;
    const d = base(r, r.customer_name || r.company_name || "", r.is_active ? "Active" : "Inactive", r.company_name || "", [
      f("acct.customer_name", "Customer", r.customer_name), f("acct.company_name", "Company", r.company_name),
      f("sed.f_contact_person", "Contact Person", r.contact_person), f("sed.f_mobile", "Mobile", r.mobile),
      f("sed.f_whatsapp", "WhatsApp", r.whatsapp), f("sed.f_email", "Email", r.email),
      f("sed.f_address", "Address", r.address), f("sed.f_notes", "Notes", r.notes)
    ], r.country_name || "");
    d.audit = await auditFor(sql, "customers", id); d.attachments = await attachmentsFor(sql, "customers", id);
    return d;
  }
  if (kind === "company") {
    const [r] = await sql`select c.*, co.name country_name from companies c left join countries co on co.id=c.country_id where c.id=${id} and c.deleted_at is null`;
    if (!r) return null;
    const d = base(r, r.name || "", r.is_active ? "Active" : "Inactive", r.legal_name || "", [
      f("acct.company_name", "Company", r.name), f("sed.f_legal_name", "Legal Name", r.legal_name),
      f("sed.f_owner_name", "Owner Name", r.owner_name), f("sed.f_business_type", "Business Type", r.business_type),
      f("sed.f_base_currency", "Base Currency", r.base_currency), f("sed.f_address", "Address", r.address)
    ], r.country_name || r.country_name);
    d.audit = await auditFor(sql, "companies", id); d.attachments = await attachmentsFor(sql, "companies", id);
    return d;
  }
  if (kind === "bank") {
    const [r] = await sql`select b.*, co.name country_name from banks b left join countries co on co.id=b.country_id where b.id=${id} and b.deleted_at is null`;
    if (!r) return null;
    const d = base(r, r.account_number || r.bank_name || "", r.account_status || "Active", r.account_title || "", [
      f("sed.f_bank_name", "Bank Name", r.bank_name), f("sed.f_account_title", "Account Title", r.account_title),
      f("sed.f_account_number", "Account Number", r.account_number), f("sed.f_iban", "IBAN", r.iban_number),
      f("rozrep.currency", "Currency", r.currency), f("sed.f_bank_type", "Bank Type", r.bank_type),
      f("sed.f_account_type", "Account Type", r.account_type), f("sed.f_branch_name", "Branch Name", r.branch_name),
      f("sed.f_swift", "SWIFT / BIC", r.swift_bic), f("sed.f_phone", "Phone", r.phone),
      f("sed.f_email", "Email", r.email), f("sed.f_website", "Website", r.website), f("sed.f_address", "Address", r.full_address)
    ], r.country_name || "");
    d.audit = await auditFor(sql, "banks", id); d.attachments = await attachmentsFor(sql, "banks", id);
    return d;
  }
  if (kind === "employee") {
    const [r] = await sql`
      select em.*, co.name country_name, coalesce(cib.name, cb.name) branch_name,
        (select full_name from profiles pr where pr.id = em.person_master_id or pr.person_master_id = em.person_master_id limit 1) person_name
      from employees em
      left join countries co on co.id=em.country_id
      left join city_branches cib on cib.id=em.city_branch_id
      left join country_branches cb on cb.id=em.country_branch_id
      where em.id=${id} and em.deleted_at is null`;
    if (!r) return null;
    const d = base(r, r.employee_code || r.person_name || "", r.status || r.job_status || "Active", r.designation || "", [
      f("sed.f_full_name", "Full Name", r.person_name), f("sed.f_employee_code", "Employee Code", r.employee_code),
      f("sed.f_designation", "Designation", r.designation), f("sed.f_department", "Department", r.department),
      f("sed.f_category", "Category", r.category), f("sed.f_employment_type", "Employment Type", r.employment_type),
      f("sed.f_job_status", "Job Status", r.job_status), f("sed.f_joining_date", "Joining Date", r.joining_date),
      f("sed.f_salary", "Monthly Salary", r.monthly_salary ? money(r.monthly_salary) + (r.salary_currency ? " " + r.salary_currency : "") : "")
    ], r.country_name || "", r.branch_name || "");
    d.audit = await auditFor(sql, "employees", id); d.attachments = await attachmentsFor(sql, "employees", id);
    return d;
  }
  if (kind === "warehouse") {
    const [r] = await sql`select w.*, co.name country_name from warehouses w left join countries co on co.id=w.country_id where w.id=${id} and w.deleted_at is null`;
    if (!r) return null;
    const d = base(r, r.warehouse_code || r.warehouse_name || "", r.status || "Active", r.warehouse_name || "", [
      f("sed.f_warehouse_code", "Warehouse Code", r.warehouse_code), f("acct.company_name", "Warehouse Name", r.warehouse_name),
      f("sed.f_warehouse_type", "Warehouse Type", r.warehouse_type), f("sed.f_owner_name", "Owner Name", r.owner_name),
      f("sed.f_phone", "Phone", r.contact_number), f("sed.f_address", "Address", r.full_address)
    ], r.country_name || "");
    d.audit = await auditFor(sql, "warehouses", id); d.attachments = await attachmentsFor(sql, "warehouses", id);
    return d;
  }
  if (kind === "goods") {
    const [r] = await sql`select g.*, co.name origin_country_name from goods g left join countries co on co.id=g.origin_country_id where g.id=${id} and g.deleted_at is null`;
    if (!r) return null;
    const d = base(r, r.chs_code || r.goods_name || "", r.is_active ? "Active" : "Inactive", r.goods_name || "", [
      f("sed.f_goods_name", "Goods Name", r.goods_name), f("sed.f_chs_code", "HS / CHS Code", r.chs_code),
      f("sed.f_origin_country", "Origin Country", r.origin_country_name)
    ], r.origin_country_name || "");
    d.audit = await auditFor(sql, "goods", id); d.attachments = await attachmentsFor(sql, "goods", id);
    return d;
  }
  if (kind === "user") {
    const [r] = await sql`select u.* from profiles u where u.id=${id} and u.deleted_at is null`;
    if (!r) return null;
    const d = base(r, r.user_code || r.full_name || "", "Active", r.full_name || "", [
      f("sed.f_full_name", "Full Name", r.full_name), f("sed.f_user_code", "User Code", r.user_code),
      f("sed.f_language", "Preferred Language", r.preferred_language_code)
    ]);
    d.audit = await auditFor(sql, "profiles", id); d.attachments = await attachmentsFor(sql, "profiles", id);
    return d;
  }
  return null;
}

export async function resolveEntryDetail(sql: any, opts: { id: string; module: string; src: string }): Promise<Detail | null> {
  const which = resolverFor(opts.module, opts.src);
  if (which === "roznamcha") return roznamcha(sql, opts.id);
  if (which === "purchase") return purchase(sql, opts.id);
  if (which === "sales") return sales(sql, opts.id);
  if (["customer", "company", "bank", "employee", "warehouse", "goods", "user", "supplier"].includes(which)) {
    return master(sql, opts.id, which === "supplier" ? "company" : which);
  }
  return roznamcha(sql, opts.id);
}

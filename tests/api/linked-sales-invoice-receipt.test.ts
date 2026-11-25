import { NextRequest } from "next/server";
import { beforeEach, expect, it, vi } from "vitest";
import { POST } from "@/app/api/erp/sales/orders/[id]/payments/route";
import { ApiClientError } from "@/lib/api/response";

const m = vi.hoisted(() => ({ query: vi.fn(), authorize: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ requireErpSession: async () => ({ userId: "test-user" }) }));
vi.mock("@/lib/api/scope-middleware", () => ({ authorizeApiScope: m.authorize }));
vi.mock("@/lib/supabase/config", () => ({ isSupabaseConfigured: () => true }));
vi.mock("@/lib/services/form-serials", () => ({ allocateFormSerials: vi.fn() }));
vi.mock("@/lib/api/idempotency", () => ({
  acquireIdempotencyLock: async () => ({ acquired: true, idempotencyKey: "mock", tenantHash: "mock" }),
  commitIdempotencySuccess: vi.fn(async () => undefined), releaseIdempotencyLock: vi.fn(async () => undefined),
  buildReplayedResponse: vi.fn(),
}));
vi.mock("@/lib/db/local-postgres", () => {
  const sql = (strings: TemplateStringsArray, ...values: unknown[]) => m.query(strings.join("?"), values);
  sql.begin = (fn: (conn: typeof sql) => unknown) => fn(sql);
  sql.json = (value: unknown) => JSON.stringify(value);
  return { withLocalPg: (fn: (conn: typeof sql) => unknown) => fn(sql) };
});
const id = "e73b8a60-042e-4ff5-a7e1-fce71c64a502";
const invoice = "b78ef105-dfe2-472c-8016-cae6f19de8af";
const dr = "b78ef105-dfe2-472c-8016-cae6f19de8b0";
const cr = "b78ef105-dfe2-472c-8016-cae6f19de8b1";
const base = { id, ledger_posting_status: "posted", paid_amount: 0, remaining_amount: 100, currency_code: "USD",
  form_data: { form: { paymentType: "Invoice" }, transferTrace: { debitLedgerId: cr, settlement: { finalCurrency: "AED", originalAmount: 100, finalAmount: 367 } } } };
const send = (body: Record<string, unknown> = {}) => POST(new NextRequest(`http://test/api/erp/sales/orders/${id}/payments`, {
  method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ linkedBalanceReceipt: true, salesInvoiceId: invoice, entryDate: "2026-11-25", kind: "remaining",
    receiptDetails: { channel: "cash", partyName: "QA Party", mobile: "+971 50 123 4567", idTail: "7890" },
    amount: 73.4, exchangeRate: 3.67, currencyCode: "AED", debitLedgerId: dr, creditLedgerId: cr, referenceNo: "T", ...body }),
}), { params: Promise.resolve({ id }) });

function arrange({ order = base, receivingCurrency = "AED", finalized = false, duplicate = false } = {}) {
  m.query.mockImplementation(async (sql: string, values: unknown[]) => {
    if (sql.includes("pg_try_advisory_xact_lock")) return [{ got: true }];
    if (sql.includes("from ledgers")) return [{ id: values[0], currency: receivingCurrency, is_active: true }];
    if (sql.includes("from sales_orders")) return [order];
    if (sql.includes("from public.business_edit_invoices")) return finalized ? [{ id: invoice }] : [];
    if (sql.includes("join public.roznamcha_entries")) return duplicate ? [{ id: "prior-payment" }] : [];
    return [];
  });
}
beforeEach(() => { vi.resetAllMocks(); arrange(); });

it("rejects missing, draft, non-sales, or unrelated invoices before posting and looks up the exact IDs", async () => {
  const res = await send();
  expect(res.status).toBe(409);
  expect((await res.json()).error.code).toBe("SALES_INVOICE_RECEIPT_MISMATCH");
  const lookup = m.query.mock.calls.find(([sql]) => sql.includes("from public.business_edit_invoices"));
  expect(lookup?.[0]).toMatch(/source_id = \?::uuid[\s\S]+txn_kind = 'sales'[\s\S]+status = 'finalized'[\s\S]+i.id = \?::uuid[\s\S]+for share/);
  expect(lookup?.[1]).toContain(id);
  expect(lookup?.[1]).toContain(invoice);
  expect(m.query.mock.calls.flat().join(" ")).not.toContain("select post_sales_booking_transfer");
});

it("rejects an overpayment or duplicate reference before posting a linked invoice receipt", async () => {
  arrange({ finalized: true, duplicate: true });
  const duplicate = await send();
  expect((await duplicate.json()).error.code).toBe("SALES_RECEIPT_REFERENCE_EXISTS");
  const excess = await send({ amount: 367.1 });
  expect((await excess.json()).error.code).toBe("SALES_RECEIPT_SETTLEMENT_MISMATCH");
  expect(m.query.mock.calls.flat().join(" ")).not.toContain("select post_sales_booking_transfer");
});

it("blocks wrong-stage, fully paid, wrong-currency and unauthorized branch submissions", async () => {
  arrange({ finalized: true });
  expect((await (await send({ kind: "credit" })).json()).error.code).toBe("SALES_RECEIPT_QUEUE_MISMATCH");
  arrange({ order: { ...base, paid_amount: 100, remaining_amount: 0 }, finalized: true });
  expect((await (await send()).json()).error.code).toBe("SALES_RECEIPT_QUEUE_MISMATCH");
  arrange({ receivingCurrency: "USD", finalized: true });
  expect((await (await send()).json()).error.code).toBe("SALES_RECEIVING_ACCOUNT_MISMATCH");
  m.authorize.mockImplementation(() => { throw new ApiClientError("Wrong branch.", { status: 403, code: "FORBIDDEN" }); });
  expect((await send()).status).toBe(403);
  expect(m.query.mock.calls.flat().join(" ")).not.toContain("select post_sales_booking_transfer");
});

it("posts a finalized Local Sales invoice through one balanced Roznamcha receipt and updates the original-currency balance", async () => {
  const order = { ...base, country_id: dr, form_data: { ...base.form_data, form: { paymentType: "Invoice", saleSource: "local" }, transferTrace: { ...base.form_data.transferTrace, settlement: { ...base.form_data.transferTrace.settlement, originalCurrency: "USD", exchangeRate: 3.67, operator: "*" } } } };
  const voucher = { id: invoice, sales_order_id: id, roznamcha_entry_id: id, currency_code: "AED", amount: 73.4, status: "posted" };
  m.query.mockImplementation(async (sql: string, values: unknown[]) => {
    if (sql.includes("pg_try_advisory_xact_lock")) return [{ got: true }];
    if (sql.includes("from ledgers")) return [{ id: values[0], currency: "AED", is_active: true }];
    if (sql.includes("from sales_orders")) return [order];
    if (sql.includes("from public.business_edit_invoices")) return [{ id: invoice }];
    if (sql.includes("select post_sales_booking_transfer")) return [{ id: invoice }];
    if (sql.includes("from roznamcha_lines")) return [
      { ledger_id: dr, debit: 73.4, credit: 0 }, { ledger_id: cr, debit: 0, credit: 73.4 },
    ];
    if (sql.includes("from roznamcha_entries")) return [{ id, super_admin_serial_number: "T-01", country_transaction_serial_number: "T-AE-01", branch_transaction_serial_number: "T-DXB-01" }];
    if (sql.includes("from sales_order_payments")) return [voucher];
    return [];
  });
  const result = await send({ receiptInput: { currency: "USD", amount: 20 } });
  expect(result.status).toBe(201);
  const sqlCalls = m.query.mock.calls;
  expect(sqlCalls.find(([sql]) => sql.includes("from public.business_edit_invoices"))?.[1]).toContain("local_sales");
  const receiptCalls = sqlCalls.filter(([sql]) => sql.includes("select post_sales_booking_transfer"));
  expect(receiptCalls).toHaveLength(1);
  expect(receiptCalls[0][1].at(-1)).toContain("Receipt FX: 20 USD * 3.67 = 73.4 AED");
  expect(receiptCalls[0][1].at(-1)).toContain("Cash | Receiver/Sender: QA Party | Mobile: +971 50 123 4567 | ID: •••• 7890");
  expect(sqlCalls.find(([sql]) => sql.includes("update roznamcha_entries"))?.[1]).toContain("cash");
  expect(receiptCalls[0][1].slice(1, 9)).toEqual([id, "remaining", "2026-11-25", 73.4, "AED", 1, dr, cr]);
  expect(sqlCalls.find(([sql]) => sql.includes("update public.sales_orders set paid_amount"))?.[1]).toEqual([20, 80, "partially_paid", id]);
});

it("requires channel details, preserves the Cash queue, and rejects a missing or foreign bank", async () => {
  expect((await (await send({ receiptDetails: undefined })).json()).error.code).toBe("SALES_RECEIPT_DETAILS_REQUIRED");
  const bankDetails = { channel: "bank", bankId: invoice };
  expect((await (await send({ receiptDetails: bankDetails, salesWorkflowQueue: "cash" })).json()).error.code).toBe("SALES_RECEIPT_DETAILS_REQUIRED");
  arrange({ order: { ...base, country_id: dr } as typeof base });
  const bank = await send({ receiptDetails: bankDetails });
  expect((await bank.json()).error.code).toBe("SALES_RECEIPT_BANK_MISMATCH");
  const lookup = m.query.mock.calls.find(([sql]) => sql.includes("from public.banks"));
  expect(lookup?.[0]).toMatch(/country_id = [\s\S]*is_active = true/);
  expect(lookup?.[1]).toEqual([invoice, dr]);
  expect(m.query.mock.calls.flat().join(" ")).not.toContain("select post_sales_booking_transfer");
});

it("records the selected Bank / Cheque master reference without copying the full account number into narration", async () => {
  const order = { ...base, country_id: dr };
  const voucher = { id: invoice, sales_order_id: id, roznamcha_entry_id: id, currency_code: "AED", amount: 73.4, status: "posted" };
  m.query.mockImplementation(async (sql: string, values: unknown[]) => {
    if (sql.includes("pg_try_advisory_xact_lock")) return [{ got: true }];
    if (sql.includes("from ledgers")) return [{ id: values[0], currency: "AED", is_active: true }];
    if (sql.includes("from sales_orders")) return [order];
    if (sql.includes("from public.business_edit_invoices")) return [{ id: invoice }];
    if (sql.includes("from public.banks")) return [{ id: invoice, bank_name: "QA Bank", account_number: "QA1200078834" }];
    if (sql.includes("select post_sales_booking_transfer")) return [{ id: invoice }];
    if (sql.includes("from roznamcha_lines")) return [
      { ledger_id: dr, debit: 73.4, credit: 0 }, { ledger_id: cr, debit: 0, credit: 73.4 },
    ];
    if (sql.includes("from roznamcha_entries")) return [{ id, super_admin_serial_number: "T-01", country_transaction_serial_number: "T-AE-01", branch_transaction_serial_number: "T-DXB-01" }];
    if (sql.includes("from sales_order_payments")) return [voucher];
    return [];
  });
  const result = await send({ receiptInput: { currency: "AED", amount: 73.4 }, receiptDetails: { channel: "bank", bankId: invoice, mode: "Cheque" }, typeDetails: { paymentMethod: "bank" } });
  expect(result.status).toBe(201);
  const posting = m.query.mock.calls.find(([sql]) => sql.includes("select post_sales_booking_transfer"));
  expect(posting?.[1].at(-1)).toContain("Bank: QA Bank | Bank Account: •••• 8834 | Transfer Type: Cheque");
  expect(posting?.[1].at(-1)).not.toContain("QA1200078834");
  const update = m.query.mock.calls.find(([sql]) => sql.includes("update roznamcha_entries"));
  expect(update?.[1]).toContain(invoice);
  expect(update?.[1]).toContain("bank");
});

it("recomputes a foreign input against the original approved rate and blocks a changed currency or final amount", async () => {
  const order = { ...base, form_data: { ...base.form_data, transferTrace: { ...base.form_data.transferTrace,
    settlement: { ...base.form_data.transferTrace.settlement, originalCurrency: "USD", exchangeRate: 3.67, operator: "*" } } } };
  arrange({ finalized: true, order });
  expect((await (await send({ receiptInput: { currency: "USD", amount: 20 }, amount: 80 })).json()).error.code).toBe("SALES_RECEIPT_FX_MISMATCH");
  expect((await (await send({ receiptInput: { currency: "PKR", amount: 20 }, amount: 73.4 })).json()).error.code).toBe("SALES_RECEIPT_FX_MISMATCH");
  expect(m.query.mock.calls.flat().join(" ")).not.toContain("select post_sales_booking_transfer");
});

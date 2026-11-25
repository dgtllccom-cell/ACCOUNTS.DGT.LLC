// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import type { ErpSession } from "@/lib/auth/session";

const state = vi.hoisted(() => ({
  session: {} as Partial<ErpSession>,
  rows: [] as Record<string, unknown>[],
  calls: [] as { query: string; values: unknown[] }[],
  languages: [] as string[],
  rejectTranslations: false,
}));

vi.mock("@/lib/auth/session", () => ({ requireErpSession: async () => state.session }));
vi.mock("@/lib/i18n/server", () => ({ getRequestLanguage: async (lang: string | null) => lang || "en" }));
vi.mock("@/lib/i18n/localize-records", () => ({
  localizeRecordGroups: async (groups: { records: Record<string, string>[]; table: string; fields: string[] }[], lang: string) => {
    state.languages.push(lang);
    if (state.rejectTranslations) throw new Error("translations unavailable");
    return groups.map(({ records, table, fields }) => records.map(row => lang === "ur" && row.id
      ? { ...row, [fields[0]]: `ur:${table}:${row[fields[0]]}` } : row));
  },
}));
vi.mock("@/lib/api/response", () => ({
  apiOk: (data: unknown, options: ResponseInit) => NextResponse.json({ ok: true, data }, options),
  apiError: (code: string, message: string, status: number) => NextResponse.json({ ok: false, error: { code, message } }, { status }),
  handleApiError: (error: Error) => NextResponse.json({ ok: false, error: { message: error.message } }, { status: 403 }),
}));
vi.mock("@/lib/db/local-postgres", () => ({
  withLocalPg: async (fn: (tag: (parts: TemplateStringsArray, ...values: unknown[]) => unknown) => unknown) =>
    fn((parts, ...values) => {
      state.calls.push({ query: parts.join("?"), values });
      return state.rows;
    }),
}));
import { GET } from "@/app/api/erp/purchases/orders/[id]/payments/[paymentId]/route";

const order = "11111111-1111-4111-8111-111111111111";
const payment = "22222222-2222-4222-8222-222222222222";
const country = "33333333-3333-4333-8333-333333333333";
const branch = "44444444-4444-4444-8444-444444444444";
const city = "55555555-5555-4555-8555-555555555555";
const otherCity = "66666666-6666-4666-8666-666666666666";
const dr = { ledger_id: "ledger-payable", ledger_name: "Vendor Payable", ledger_code: "PAY-01", account_number: "AP-071", debit: "250.1250", credit: "0", currency: "PKR" };
const cr = { ledger_id: "ledger-bank", ledger_name: "Bank", ledger_code: "BANK-01", account_number: "ACC-1009", debit: "0", credit: "250.1250", currency: "PKR" };

async function get(lang?: string) {
  const req = new NextRequest("http://localhost/api/erp/purchases/orders/" + order + "/payments/" + payment + (lang ? "?lang=" + lang : ""));
  const response = await GET(req, { params: Promise.resolve({ id: order, paymentId: payment }) });
  return { response, body: await response.json() };
}

beforeEach(() => {
  state.session = { userId: "test", roles: ["city_branch_admin"], permissions: ["purchases:read"], countryIds: [country],
    countryBranchIds: [branch], cityBranchIds: [city], isSuperAdmin: false, isGlobalScope: false, operationalDomains: ["business"],
    assignments: [], canViewFinancials: true };
  state.rows = [{ source: "purchase_booking", bill: "PO-765", country_id: country, country_branch_id: branch, city_branch_id: city,
    party: "Saved Supplier", voucher_no: "REAL-VOUCHER", journal_serial: "GLOBAL-RZ-123", date: "2026-11-24", reference: "BANK-REF-42",
    goods_lines: [{ goodsName: "  Green Tea " }, { goodsName: "—", name: "Cardamom" }, {}, null],
    header_goods_name: "Old header", lines: [cr, dr] }];
  state.calls = [];
  state.languages = [];
  state.rejectTranslations = false;
});

describe("read-only posted purchase receipt", () => {
  it("selects the exact payment/bill relationship and reads the original journal, not payment display values", async () => {
    const { response, body } = await get();
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(body.data).toMatchObject({ source: "purchase_booking", bill: "PO-765", number: "REAL-VOUCHER", party: "Saved Supplier",
      reference: "BANK-REF-42", goodsNames: ["Green Tea", "Cardamom"],
      debit: { name: "Vendor Payable", accountNumber: "AP-071", amount: 250.125, currency: "PKR" },
      credit: { name: "Bank", accountNumber: "ACC-1009", amount: 250.125, currency: "PKR" } });
    expect(state.calls[0].values).toEqual([payment, order, order]);
    for (const x of ["p.id = ?::uuid", "(po.id = ?::uuid or lp.id = ?::uuid)", "j.id = p.roznamcha_entry_id", "j.status = 'posted'",
      "j.posted_at is not null", "p.status = 'posted'", "p.kind <> 'booking'", "p.deleted_at is null",
      "and p.local_purchase_id is null", "and p.purchase_order_id is null", "where l.roznamcha_entry_id = j.id",
      "to_jsonb(lp)->'line_items'", "po.form_data->'goodsEntries'", "coalesce(l.enterprise_account_id, a.enterprise_account_id)",
      "nullif(btrim(l.account_number), ''), nullif(btrim(ea.account_number), '')"]) {
      expect(state.calls[0].query).toContain(x);
    }
    expect(state.calls[0].query).not.toMatch(/\b(insert|update|delete)\s/i);
    expect(state.calls[0].query).not.toContain("public.banks");
  });

  it("prints the stored Local Purchase journal bill, not a different manual or typed contract reference", async () => {
    Object.assign(state.rows[0], { source: "local_purchase", bill: null, journal_serial_no: "LP-JRN-0057", manual_bill_no: "LP-MANUAL-98",
      goods_lines: JSON.stringify([{ goodsName: "Beans" }, { goodsName: "Black Tea" }]), header_goods_name: "Old header" });
    expect((await get()).body.data).toMatchObject({ bill: "LP-JRN-0057", source: "local_purchase", goodsNames: ["Beans", "Black Tea"] });
    state.rows[0].journal_serial_no = null;
    state.rows[0].goods_lines = [];
    expect((await get()).body.data).toMatchObject({ bill: "LP-MANUAL-98", goodsNames: ["Old header"] });
    state.rows[0].header_goods_name = "—";
    expect((await get()).body.data.goodsNames).toBeUndefined();
    state.rows[0].manual_bill_no = null;
    expect((await get()).response.status).toBe(409);
  });

  it("rejects a missing or reversed journal, and an unbalanced recorded pair", async () => {
    state.rows[0].lines = [dr, { ...cr, credit: "250.1249" }];
    expect((await get()).response.status).toBe(409);
    state.rows = [];
    expect((await get()).response.status).toBe(404);
  });

  it("denies someone outside the exact city or without finance permission", async () => {
    state.rows[0].city_branch_id = otherCity;
    expect((await get()).response.status).toBe(403);
    state.rows[0].city_branch_id = city;
    state.session.canViewFinancials = false;
    expect((await get()).response.status).toBe(403);
    expect(state.calls).toHaveLength(1);
    expect(state.languages).toEqual([]);
  });
  it("uses viewer translations for linked names but keeps exact voucher data and saved fallback names", async () => {
    Object.assign(state.rows[0], { supplier_customer_id: country,
      goods_lines: [{ goodsName: "Green Tea", goodsId: city }, { goodsName: "Unlinked goods" }],
      lines: [{ ...cr, ledger_id: country }, { ...dr, ledger_id: branch }] });
    expect((await get("ur")).body.data).toMatchObject({
      bill: "PO-765", number: "REAL-VOUCHER", party: "ur:customers:Saved Supplier", reference: "BANK-REF-42",
      goodsNames: ["ur:goods:Green Tea", "Unlinked goods"],
      debit: { name: "ur:ledgers:Vendor Payable", accountNumber: "AP-071", amount: 250.125, currency: "PKR" },
      credit: { name: "ur:ledgers:Bank", accountNumber: "ACC-1009" },
    });
    Object.assign(state.rows[0], { source: "local_purchase", journal_serial_no: "LP-55", goods_lines: [], header_goods_id: city });
    expect((await get("ur")).body.data).toMatchObject({ party: "ur:local_purchases:Saved Supplier", goodsNames: ["ur:goods:Old header"] });
    state.rejectTranslations = true;
    expect((await get("ur")).body.data).toMatchObject({ party: "Saved Supplier", goodsNames: ["Old header"] });
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React, { createElement } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { apiGet } from "@/lib/api/client";
import { openInvoiceDocument } from "@/lib/reports/invoice-templates";
import { normalizeTemplateDefault, resolveInvoiceTemplateDefault } from "@/lib/reports/invoice-templates/resolve-default";
import {
  TradeDocumentCenter,
  canSaveDefaultFor,
  resolveBankCompanyId,
  resolveTradeSource,
  type TradeDocumentCenterProps,
} from "@/features/reports/components/trade-document-center";

vi.mock("@/lib/api/client", () => ({ apiGet: vi.fn(), apiPost: vi.fn() }));
vi.mock("@/lib/i18n/use-active-language", () => ({ useActiveLanguage: () => "en" }));
vi.mock("@/lib/reports/resolve-document-branding", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  resolveDocumentBranding: vi.fn(async () => ({ entityName: "DGT Trading LLC", legalName: null, countryName: "Pakistan", bank: null })),
}));
vi.mock("@/lib/reports/invoice-templates", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  openInvoiceDocument: vi.fn(),
}));

const SELLER_ID = "22222222-2222-4222-8222-222222222222";

const salesRecord = {
  id: "11111111-1111-4111-8111-111111111111",
  sales_order_no: "SO-0001",
  currency_code: "USD",
  exchange_rate: 1,
  order_total: 500,
  created_at: "2026-11-01T00:00:00Z",
  form_data: {
    form: { saleSource: "stock", salesCompanyId: SELLER_ID, salesCompanyName: "Seller Co", customerName: "Buyer Co" },
    goodsEntries: [{ goodsName: "Rice", qtyNo: 10, qtyName: "Bags", netWeight: 500, coursePrice: 50, totalAmount: 500 }],
  },
};

const SERVER_FALLBACK = { templateId: "classic", showLogo: true, showBankDetails: true, showTerms: true, matchedScope: null };
const SAVED_PREMIUM = { templateId: "premium", showLogo: true, showBankDetails: true, showTerms: true, matchedScope: "global" };

const apiGetMock = vi.mocked(apiGet);
const openMock = vi.mocked(openInvoiceDocument);

/* ---------- pure helpers ---------- */

describe("gallery source and company wiring (pure helpers)", () => {
  it("an explicit source always wins", () => {
    expect(resolveTradeSource({ source: "local_purchase", txnKind: "sales", record: salesRecord })).toBe("local_purchase");
  });

  it("a sale without an explicit source goes through the sales mapper", () => {
    expect(resolveTradeSource({ txnKind: "sales", record: salesRecord })).toBe("sales_order");
  });

  it("a flat local_purchases row (goods_name, no form_data) is a local purchase", () => {
    expect(resolveTradeSource({ txnKind: "purchase", record: { id: "lp-1", goods_name: "Rice" } })).toBe("local_purchase");
  });

  it("a purchase order that carries form_data stays a purchase order even if it has a goods_name field", () => {
    expect(resolveTradeSource({ txnKind: "purchase", record: { goods_name: "Rice", form_data: { form: {} } } })).toBe("purchase_order");
    expect(resolveTradeSource({ txnKind: "purchase", record: { purchase_order_no: "PO-1" } })).toBe("purchase_order");
  });

  it("the caller's companyId wins over the saved form", () => {
    expect(resolveBankCompanyId({ companyId: "caller-co", source: "sales_order", record: salesRecord })).toBe("caller-co");
  });

  it("a sale with no companyId uses the saved salesCompanyId", () => {
    expect(resolveBankCompanyId({ companyId: null, source: "sales_order", record: salesRecord })).toBe(SELLER_ID);
  });

  it("a purchase with no companyId uses the saved purchaseCompanyId, read from either form_data shape", () => {
    expect(resolveBankCompanyId({ source: "purchase_order", record: { form_data: { form: { purchaseCompanyId: "sup-1" } } } })).toBe("sup-1");
    expect(resolveBankCompanyId({ source: "purchase_order", record: { form_data: { purchaseCompanyId: "sup-2" } } })).toBe("sup-2");
  });

  it("a local purchase uses its company_id", () => {
    expect(resolveBankCompanyId({ source: "local_purchase", record: { company_id: "lp-co" } })).toBe("lp-co");
  });

  it("returns null when no company can be found", () => {
    expect(resolveBankCompanyId({ source: "sales_order", record: {} })).toBeNull();
  });

  it("offers Set Default only for the document types the default API stores", () => {
    expect(canSaveDefaultFor("commercial_invoice")).toBe(true);
    expect(canSaveDefaultFor("packing_list")).toBe(true);
    expect(canSaveDefaultFor("contract")).toBe(true);
    expect(canSaveDefaultFor("purchase_invoice")).toBe(false);
    expect(canSaveDefaultFor("sales_invoice")).toBe(false);
    expect(canSaveDefaultFor("tax_invoice")).toBe(false);
    expect(canSaveDefaultFor("purchase_order")).toBe(false);
  });
});

/* ---------- default-template payload ---------- */

describe("default template payload", () => {
  it("rejects a template id this build does not have, so nothing renders as another template silently", () => {
    expect(normalizeTemplateDefault({ templateId: "minimal", showLogo: true })).toBeNull();
    expect(normalizeTemplateDefault(undefined)).toBeNull();
  });

  it("keeps a valid saved default and its display flags", () => {
    expect(normalizeTemplateDefault({ templateId: "premium", showLogo: false, showBankDetails: true, showTerms: false, matchedScope: "city_branch" })).toEqual({
      templateId: "premium", showLogo: false, showBankDetails: true, showTerms: false, matchedScope: "city_branch",
    });
  });
});

describe("resolveInvoiceTemplateDefault", () => {
  beforeEach(() => { apiGetMock.mockReset(); });

  it("returns a saved default without a load failure", async () => {
    apiGetMock.mockResolvedValueOnce({ default: SAVED_PREMIUM } as never);
    const r = await resolveInvoiceTemplateDefault({ documentType: "commercial_invoice" });
    expect(r.templateId).toBe("premium");
    expect(r.loadFailed).toBeUndefined();
  });

  it("treats the server's built-in fallback (no saved row) as a normal result", async () => {
    apiGetMock.mockResolvedValueOnce({ default: SERVER_FALLBACK } as never);
    const r = await resolveInvoiceTemplateDefault({ documentType: "packing_list" });
    expect(r.templateId).toBe("classic");
    expect(r.matchedScope).toBeNull();
    expect(r.loadFailed).toBeUndefined();
  });

  it("flags a saved default that names a retired template instead of presenting classic as the saved choice", async () => {
    apiGetMock.mockResolvedValueOnce({ default: { ...SAVED_PREMIUM, templateId: "retired-template" } } as never);
    const r = await resolveInvoiceTemplateDefault({ documentType: "commercial_invoice" });
    expect(r.loadFailed).toBe(true);
    expect(r.templateId).toBe("classic");
  });

  it("flags a failed lookup instead of silently returning classic", async () => {
    apiGetMock.mockRejectedValueOnce(new Error("Not authorized for this country's template defaults"));
    const r = await resolveInvoiceTemplateDefault({ documentType: "commercial_invoice", countryId: "c-1" });
    expect(r.loadFailed).toBe(true);
    expect(r.templateId).toBe("classic");
  });
});

/* ---------- gallery behaviour ---------- */

type Deferred<T> = { promise: Promise<T>; resolve: (value: T) => void };
function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => { resolve = r; });
  return { promise, resolve };
}

function routeApi(defaults: () => Promise<unknown>, banks: unknown = { banks: [] }) {
  apiGetMock.mockImplementation(((url: string) => {
    if (url.startsWith("/api/erp/invoice-template-defaults")) return defaults();
    if (url.includes("/bank-accounts")) return Promise.resolve(banks);
    return Promise.reject(new Error("unexpected " + url));
  }) as never);
}

function renderCenter(overrides: Partial<TradeDocumentCenterProps> = {}) {
  const onClose = vi.fn();
  const props = { open: true, onClose, txnKind: "sales", record: salesRecord, ...overrides } as TradeDocumentCenterProps;
  render(createElement(TradeDocumentCenter, props));
  return { onClose };
}

/** Plain text lookup: getByRole walks the accessibility tree and is too slow inside waitFor polling on this DOM. */
function buttonByLabel(label: string): HTMLButtonElement {
  const found = Array.from(document.querySelectorAll("button")).find((b) => b.textContent?.trim() === label);
  if (!found) throw new Error("no button labelled " + label);
  return found;
}

function previewButton() {
  return buttonByLabel("Preview Document");
}

describe("Commercial Document Center: preview and default behaviour", () => {
  beforeEach(() => {
    // The SWC transform emits classic-runtime JSX, so the component needs React in scope (same as the journal test).
    vi.stubGlobal("React", React);
    apiGetMock.mockReset();
    openMock.mockReset();
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("does not print before the saved default has loaded, then prints that template", async () => {
    const lookup = deferred<unknown>();
    routeApi(() => lookup.promise);
    renderCenter();
    expect(previewButton().disabled).toBe(true);
    lookup.resolve({ default: SAVED_PREMIUM });
    await waitFor(() => expect(previewButton().disabled).toBe(false));
    fireEvent.click(previewButton());
    await waitFor(() => expect(openMock).toHaveBeenCalledTimes(1));
    expect(openMock.mock.calls[0][1]).toBe("premium");
  });

  it("keeps a template the user picked while the saved default is still loading", async () => {
    const lookup = deferred<unknown>();
    routeApi(() => lookup.promise);
    renderCenter();
    fireEvent.click(buttonByLabel("Modern"));
    lookup.resolve({ default: SAVED_PREMIUM });
    await waitFor(() => expect(previewButton().disabled).toBe(false));
    fireEvent.click(previewButton());
    await waitFor(() => expect(openMock).toHaveBeenCalledTimes(1));
    expect(openMock.mock.calls[0][1]).toBe("modern");
  });

  it("says so when the saved default cannot be read, blocks Set Default, and prints the built-in template", async () => {
    routeApi(async () => { throw new Error("network down"); });
    renderCenter();
    expect(await screen.findByText(/could not be loaded/)).toBeTruthy();
    expect(buttonByLabel("Set Default").disabled).toBe(true);
    await waitFor(() => expect(previewButton().disabled).toBe(false));
    fireEvent.click(previewButton());
    await waitFor(() => expect(openMock).toHaveBeenCalledTimes(1));
    expect(openMock.mock.calls[0][1]).toBe("classic");
  });

  it("does not offer Set Default for a document type the default API cannot store", async () => {
    routeApi(async () => ({ default: SERVER_FALLBACK }));
    renderCenter();
    fireEvent.click(buttonByLabel("Purchase Invoice"));
    expect(await screen.findByText(/not available for this document type/)).toBeTruthy();
    expect(buttonByLabel("Set Default").disabled).toBe(true);
  });

  it("keeps the dialog open and reports a failed build instead of closing silently", async () => {
    routeApi(async () => ({ default: SERVER_FALLBACK }));
    openMock.mockImplementation(() => { throw new Error("render failed"); });
    const { onClose } = renderCenter();
    await waitFor(() => expect(previewButton().disabled).toBe(false));
    fireEvent.click(previewButton());
    expect((await screen.findByRole("alert")).textContent).toContain("Could not build this document");
    expect(onClose).not.toHaveBeenCalled();
  });

  it("lists the sale's own company bank accounts when the caller passes no companyId", async () => {
    routeApi(async () => ({ default: SERVER_FALLBACK }), { banks: [{ bankName: "National Bank", accountNumber: "0012", currency: "USD" }] });
    renderCenter();
    expect(await screen.findByRole("option", { name: /National Bank/ })).toBeTruthy();
    expect(apiGetMock).toHaveBeenCalledWith(`/api/erp/companies/${SELLER_ID}/bank-accounts`);
  });

  it("sends a local sale to the local tax layout, and the document number comes from the saved order", async () => {
    routeApi(async () => ({ default: SERVER_FALLBACK }));
    const localRecord = {
      ...salesRecord,
      form_data: { ...salesRecord.form_data, form: { ...salesRecord.form_data.form, saleSource: "local" } },
    };
    renderCenter({ record: localRecord });
    await waitFor(() => expect(previewButton().disabled).toBe(false));
    fireEvent.click(previewButton());
    await waitFor(() => expect(openMock).toHaveBeenCalledTimes(1));
    expect(openMock.mock.calls[0][0]).toMatchObject({ layout: "uae_tax", docNo: "CI-SO-0001", docType: "commercial_invoice", txnKind: "sales" });
  });
});

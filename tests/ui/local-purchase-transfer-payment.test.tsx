import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { t } from "@/lib/i18n/ui";

const state = vi.hoisted(() => ({ highlight: "", lang: "en" as any }));
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(state.highlight ? `billId=${state.highlight}` : "") }));
const translate = (key: string, fallback: string) => t(state.lang, key, fallback);
vi.mock("@/lib/i18n/use-erp-screen", () => ({ useErpScreen: () => ({ lang: state.lang, isRtl: state.lang !== "en", tGlobal: translate }) }));
import { LocalPurchaseTransferPaymentView } from "@/features/purchases/components/local-purchase-transfer-payment-view";

const bill = (status = "accepted", id = "queued") => ({
  id, status, bill_no: `BILL-${id}`, goods_name: "Walnuts", local_currency: "AED", final_cost: 100,
  numbers: 5, quantity_name: "Bags", purchase_account_no: "DR-1", sales_account_no: "CR-1",
  payment_mode: "Credit", country_id: "AE", country_code: "AE",
  ...(status === "posted" ? { roznamcha_entry_id: "roz-1" } : {}),
});
let records: any[];
let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  state.highlight = ""; state.lang = "en";
  records = [bill(), bill("draft", "draft"), bill("posted", "old")];
  fetchMock = vi.fn(async (_url: string, options?: RequestInit) => {
    if (options?.method === "POST") {
      records[0] = bill("posted");
      return { ok: true, json: async () => ({ ok: true, data: { purchase: records[0] } }) };
    }
    return { ok: true, json: async () => ({ ok: true, data: { purchases: records } }) };
  });
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
const mount = () => render(<LocalPurchaseTransferPaymentView session={{ isSuperAdmin: true }} />);
async function openQueued() {
  state.highlight = "queued";
  mount();
  return await screen.findByRole("dialog");
}

describe("Transfer Payment review", () => {
  it("reads the actual API envelope and excludes drafts", async () => {
    mount();
    await screen.findByText("BILL-queued");
    expect(screen.queryByText("BILL-draft")).toBeNull();
    expect(screen.getByText("BILL-old")).toBeTruthy();
    expect(fetchMock.mock.calls.filter(([, options]) => options?.method === "POST")).toHaveLength(0);
  });
  it("opens the transferred bill, requires review, and posts it only once", async () => {
    const modal = within(await openQueued());
    const post = modal.getByRole("button", { name: "Transfer & Post" }) as HTMLButtonElement;
    expect(post.disabled).toBe(true);
    fireEvent.click(modal.getByRole("checkbox"));
    fireEvent.click(post);
    fireEvent.click(post);
    await modal.findByText("Posted to Business Roznamcha and Ledgers");
    expect(modal.queryByRole("button", { name: "Transfer & Post" })).toBeNull();
    const posts = fetchMock.mock.calls.filter(([, options]) => options?.method === "POST");
    expect(posts).toHaveLength(1);
    expect(JSON.parse(posts[0][1]!.body as string)).toEqual({ purchaseId: "queued", reviewed: true });
  });
  it("keeps a failed post open for retry and does not report success", async () => {
    fetchMock.mockImplementation(async (_url: string, options?: RequestInit) => options?.method === "POST"
      ? { ok: false, json: async () => ({ ok: false, error: { message: "Ledger unavailable" } }) }
      : { ok: true, json: async () => ({ ok: true, data: { purchases: records } }) });
    const modal = within(await openQueued());
    fireEvent.click(modal.getByRole("checkbox"));
    fireEvent.click(modal.getByRole("button", { name: "Transfer & Post" }));
    expect(await modal.findByRole("alert")).toHaveProperty("textContent", "Ledger unavailable");
    await waitFor(() => expect((modal.getByRole("button", { name: "Transfer & Post" }) as HTMLButtonElement).disabled).toBe(false));
  });
  it("does not offer financial posting for a historical posted bill", async () => {
    state.highlight = "old"; mount();
    const modal = within(await screen.findByRole("dialog"));
    expect(modal.queryByRole("checkbox")).toBeNull();
    expect(modal.getByText("Posted to Business Roznamcha and Ledgers")).toBeTruthy();
  });
  for (const lang of ["en", "ur", "ar", "fa", "ps"]) it(`renders review controls in ${lang} with its direction`, async () => {
    state.lang = lang;
    const modalElement = await openQueued();
    expect(within(modalElement).getByRole("button", { name: t(lang as any, "lp.queue_post", "Transfer & Post") })).toBeTruthy();
    expect(document.querySelector(`[dir="${lang === "en" ? "ltr" : "rtl"}"]`)).toBeTruthy();
  });
});

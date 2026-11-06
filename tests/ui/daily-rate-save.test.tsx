import React from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { DailyExchangeRateManager } from "@/features/currency/daily-exchange-rate-manager";
const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock("@/lib/api/client", () => ({ apiGet: api.get, apiPost: api.post }));
vi.mock("@/lib/i18n/use-active-language", () => ({ useActiveLanguage: () => "en" }));
vi.mock("@/lib/i18n/ui", () => ({ t: (_lang: string, _key: string, fallback: string) => fallback }));
vi.mock("@/components/ui/erp-date-picker", () => ({ ErpDatePicker: ({ value, onChange }: any) => <input type="date" value={value || ""} onChange={(e) => onChange(e.target.value)} /> }));
const country = { id: "pk", name: "Pakistan", currency_code: "PKR", iso2: "PK" };
beforeEach(() => {
  vi.stubGlobal("React", React);
  api.get.mockReset().mockImplementation(async (url: string) => {
    if (url.includes("auth/session")) return { user: { fullName: "Trial Operator" }, scopes: { countryIds: ["pk"], summary: { countryId: "pk" } } };
    if (url.includes("locations/countries")) return { countries: [country] };
    return { rates: [], countriesStatus: [], auditHistory: [] };
  });
  api.post.mockReset().mockRejectedValue(new Error("Not authorized to save rates"));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
it("does not show a fictitious saved rate after the server rejects the save", async () => {
  const { container } = render(<DailyExchangeRateManager />);
  await waitFor(() => expect(container.textContent).toContain("Pakistan"));
  const inputs = screen.getAllByRole("spinbutton");
  fireEvent.change(inputs[0], { target: { value: "282" } });
  fireEvent.change(inputs[1], { target: { value: "280" } });
  fireEvent.submit(container.querySelector("form")!);
  await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1));
  await waitFor(() => expect(container.textContent).toContain("Not authorized to save rates"));
  const tables = Array.from(container.querySelectorAll("table"));
  expect(tables.some((table) => table.textContent?.includes("282.0000"))).toBe(false);
  expect(container.textContent).not.toContain("Exchange Rate Saved & Accepted!");
});

import React from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { DailyExchangeRateManager } from "@/features/currency/daily-exchange-rate-manager";

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock("@/lib/api/client", () => ({ apiGet: api.get, apiPost: api.post }));
vi.mock("@/lib/i18n/use-active-language", () => ({ useActiveLanguage: () => "en" }));
vi.mock("@/lib/i18n/ui", () => ({ t: (_lang: string, _key: string, fallback: string) => fallback }));
vi.mock("@/components/ui/erp-date-picker", () => ({ ErpDatePicker: ({ value, onChange }: any) => <input type="date" value={value || ""} onChange={(e) => onChange(e.target.value)} /> }));

const pk = { id: "pk", name: "Pakistan", currency_code: "PKR", iso2: "PK" };
const ae = { id: "ae", name: "United Arab Emirates", currency_code: "AED", iso2: "AE" };
const us = { id: "us", name: "USA", currency_code: "USD", iso2: "US" };

// The operator's own calendar date, whatever the machine zone is.
const localToday = () => new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

beforeEach(() => {
  vi.stubGlobal("React", React);
  api.get.mockReset().mockImplementation(async (url: string) => {
    if (url.includes("auth/session")) return { user: { fullName: "Ops" }, scopes: { isSuperAdmin: true, countryIds: ["pk", "ae", "us"], summary: { countryId: "pk" } } };
    if (url.includes("locations/countries")) return { countries: [pk, ae, us] };
    return {
      rates: [],
      countriesStatus: [
        { countryId: "pk", status: "PENDING_MISSING", rateDate: localToday(), creditRate: null, debitRate: null },
        { countryId: "ae", status: "APPROVED", rateDate: localToday(), creditRate: 3.67, debitRate: 3.662 },
        { countryId: "us", status: "PENDING_MISSING", rateDate: localToday(), creditRate: null, debitRate: null },
      ],
      latestApproved: [
        { countryId: "pk", countryName: "Pakistan", currencyCode: "PKR", iso2: "PK", rateId: "r-pk", rateDate: "2026-11-14", rateTime: "09:00 AM", creditRate: 279, debitRate: 280, enteredBy: "Ops" },
      ],
      auditHistory: [],
    };
  });
  api.post.mockReset().mockResolvedValue({ ok: true });
});

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.useRealTimers(); });

it("shows the latest approved rate with its date and saves a carry-forward only after confirmation", async () => {
  render(<DailyExchangeRateManager />);
  const panel = await screen.findByTestId("fx-pending-panel");
  // Pakistan is pending: its latest approved rate and that rate's date are offered
  expect(panel.textContent).toContain("Pakistan");
  expect(panel.textContent).toContain("2026-11-14");
  expect(panel.textContent).toContain("279.0000");
  // UAE has an approved rate for today and USD is the base currency: neither is pending
  expect(panel.textContent).not.toContain("United Arab Emirates");
  expect(panel.textContent).not.toContain("USA");

  fireEvent.click(screen.getByTestId("fx-carry-forward-PK"));
  expect(api.post).not.toHaveBeenCalled();
  expect(screen.getByTestId("fx-carry-confirm-text-PK").textContent).toContain("2026-11-14");

  fireEvent.click(screen.getByTestId("fx-carry-confirm-PK"));
  await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1));
  const [url, payload] = api.post.mock.calls[0];
  expect(url).toBe("/api/erp/currency/daily-rates");
  expect(payload).toMatchObject({
    countryId: "pk",
    rateDate: localToday(),
    action: "create",
    reason: "Carried forward from 2026-11-14 (latest approved rate)",
    creditRate: 279,
    debitRate: 280,
  });
});

it("pre-fills the entry date with the operator's local calendar date, not the UTC date", async () => {
  // 2026-11-14 21:26 UTC is 2026-11-15 01:26 in Dubai. The date must follow the operator's clock.
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-14T21:26:30Z"));
  const expected = localToday();
  const { container } = render(<DailyExchangeRateManager />);
  await screen.findByTestId("fx-pending-panel");
  const dateInput = container.querySelector("form input[type=date]") as HTMLInputElement;
  expect(dateInput.value).toBe(expected);
});

it("switches to a corrected save with a required reason when the server says the date already has a rate", async () => {
  api.post
    .mockRejectedValueOnce(new Error("RATE_EXISTS_CORRECTION_REQUIRED"))
    .mockResolvedValueOnce({ ok: true });
  const { container } = render(<DailyExchangeRateManager />);
  await screen.findByTestId("fx-pending-panel");
  await waitFor(() => expect(container.querySelector("form")).not.toBeNull());
  const inputs = screen.getAllByRole("spinbutton");
  fireEvent.change(inputs[0], { target: { value: "282" } });
  fireEvent.change(inputs[1], { target: { value: "281" } });
  fireEvent.submit(container.querySelector("form")!);
  await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1));
  expect(api.post.mock.calls[0][1]).toMatchObject({ action: "create" });
  await waitFor(() => expect(container.querySelector("form label input")).not.toBeNull());

  const reason = container.querySelector("form label input") as HTMLInputElement;
  fireEvent.change(reason, { target: { value: "Bank revised the rate" } });
  fireEvent.submit(container.querySelector("form")!);
  await waitFor(() => expect(api.post).toHaveBeenCalledTimes(2));
  expect(api.post.mock.calls[1][1]).toMatchObject({ action: "correct", reason: "Bank revised the rate", creditRate: 282, debitRate: 281 });
});

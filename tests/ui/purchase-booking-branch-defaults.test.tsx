import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }), useSearchParams: () => new URLSearchParams("mode=new") }));
vi.mock("@/components/voice-form-fill", () => ({ VoiceFormFill: () => null }));
import { PurchaseOrderWizard } from "@/features/purchases/components/purchase-order-wizard.jsx";

const country = "0ae00000-0000-4000-8000-000000000001";
const main = "0ae00000-0000-4000-8000-000000000002";
const cityA = "0ae00000-0000-4000-8000-000000000003";
const cityB = "0ae00000-0000-4000-8000-000000000004";
const empty = "0ae00000-0000-4000-8000-000000000005";
const account = (id: string, branch: string, code: string, name: string, domain = "business") => ({
  id, country_id: country, country_branch_id: main, city_branch_id: branch,
  code, name, operational_domain: domain, status: "active", currency: "AED", kind: "asset"
});

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("Purchase Booking working branch in the actual form", () => {
  it.each([[cityA, "A"], [cityB, "B"], [empty, ""]])("uses only matching default accounts for scope %s", async (city, prefix) => {
    const reads: string[] = [];
    vi.stubGlobal("React", React);
    vi.stubGlobal("fetch", vi.fn(async (input: string) => {
      const url = new URL(input, "http://localhost");
      reads.push(url.pathname + url.search);
      let data: Record<string, unknown> = {};
      if (url.pathname.endsWith("/countries")) data = { countries: [{ id: country, name: "United Arab Emirates", iso2: "AE", currency_code: "AED" }] };
      if (url.pathname.endsWith("/branches/main")) data = { branches: [{ id: main, name: "Dubai Main", country_id: country, code: "AE-DXB-001" }] };
      if (url.pathname.endsWith("/branches/city")) data = { cityBranches: [
        { id: cityA, city_name: "Al Ras", code: "DXB-ALR-001" },
        { id: cityB, city_name: "Deira", code: "DXB-DEI-001" },
        { id: empty, city_name: "Al Qusais", code: "DXB-QUS-001" },
      ] };
      if (url.pathname.endsWith("/accounting/accounts")) data = { accounts: [
        account("B1", cityB, "B-PUR", "Business Purchase"), account("B2", cityB, "B-SAL", "Business Sales"),
        account("A1", cityA, "A-PUR", "Business Purchase"), account("A2", cityA, "A-SAL", "Business Sales"),
        account("E1", empty, "SHIPPING", "Business Purchase", "shipping"),
        account("E2", empty, "VENDOR", "Supplier Payable"),
      ], limit: 1000 };
      return { ok: true, json: async () => ({ ok: true, data }) };
    }));
    render(<PurchaseOrderWizard startOnForm session={{ isSuperAdmin: true, scopes: { isSuperAdmin: true }, roles: ["super_admin"] }} />);
    const title = await screen.findByRole("heading", { name: /Select Working Scope/i });
    const scope = within(title.parentElement!.parentElement!);
    const [countrySelect, mainSelect, citySelect] = scope.getAllByRole("combobox");
    fireEvent.change(countrySelect, { target: { value: country } });
    await waitFor(() => expect((mainSelect as HTMLSelectElement).options.length).toBeGreaterThan(1));
    fireEvent.change(mainSelect, { target: { value: main } });
    await waitFor(() => expect((citySelect as HTMLSelectElement).options.length).toBeGreaterThan(3));
    fireEvent.change(citySelect, { target: { value: city } });
    fireEvent.click(scope.getByRole("button", { name: /Confirm Scope/i }));
    await waitFor(() => expect(reads.some(url => url.includes("/accounting/accounts") && url.includes("cityBranchId=" + city))).toBe(true));
    if (prefix) {
      expect(await screen.findByPlaceholderText(`Business Purchase (${prefix}-PUR)`)).toBeTruthy();
      expect(await screen.findByPlaceholderText(`Business Sales (${prefix}-SAL)`)).toBeTruthy();
    } else {
      expect((await screen.findAllByPlaceholderText(/Search Code, Name, Branch/)).length).toBeGreaterThanOrEqual(2);
      expect(screen.queryByPlaceholderText(/Business Purchase|Business Sales/)).toBeNull();
    }
  });
});

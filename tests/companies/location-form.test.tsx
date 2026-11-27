import React from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CompanyIncorporationForm } from "@/features/companies/components/company-incorporation-form";

const { apiGet } = vi.hoisted(() => ({ apiGet: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/lib/api/client", () => ({ apiGet }));
vi.mock("@/lib/document-intelligence/use-intake-draft", () => ({ useIntakeDraft: () => ({}) }));
vi.mock("@/features/customers/components/customer-picker", () => ({ CustomerPicker: () => null }));
vi.mock("@/lib/i18n/use-erp-screen", () => ({
  useErpScreen: () => ({ lang: "en", t: (_: string, fallback: string) => fallback, tGlobal: (_: string, fallback: string) => fallback }),
}));
vi.mock("@/features/locations/components/location-hierarchy-select", () => ({
  LocationHierarchySelect: ({ value, onChange }: any) => (
    <div>
      <output data-testid="address-country">{value.countryId}</output>
      <button onClick={() => onChange(
        { countryId: "india", stateProvinceId: "maharashtra", cityId: "mumbai", districtId: "", areaId: "" },
        { country: { name: "India" }, state: { name: "Maharashtra" }, city: { name: "Mumbai" } },
      )}>Choose Mumbai</button>
    </div>
  ),
}));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("Company Incorporation registered address", () => {
  it("edits and reopens registered geography without rewriting existing branch links", async () => {
    let company = {
      company_type: "internal", country_id: "uae", base_currency: "AED", legal_name: "DGT fixture",
      country_name: "UAE", address: "Street line", zip_code: "00123", city_id: "dubai",
      address_country_id: "",
    };
    apiGet.mockImplementation(async (url: string) => {
      if (url.includes("?raw=1")) return { company };
      if (url.includes("/countries")) return { countries: [{ id: "uae", name: "UAE" }] };
      if (url.includes("/city-branches")) return { cityBranches: [{ id: "al-ras", name: "Al Ras", company_id: "fixture" }] };
      return {};
    });
    const save = vi.fn(async (_url: string, opts: RequestInit) => {
      const data = JSON.parse(String(opts.body));
      company = { ...company, address_country_id: data.addressCountryId, country_name: data.countryName, city_id: data.cityId };
      return { ok: true, json: async () => ({ ok: true }) };
    });
    vi.stubGlobal("fetch", save);
    vi.stubGlobal("React", React);

    const { unmount } = render(<CompanyIncorporationForm initialCompanyId="fixture" />);
    await waitFor(() => expect(screen.getByTestId("address-country").textContent).toBe("uae"));
    await waitFor(() => expect((screen.getByTestId("branch-link") as HTMLInputElement).checked).toBe(true));
    fireEvent.click(screen.getByRole("button", { name: "Choose Mumbai" }));
    expect((screen.getByTestId("country") as HTMLSelectElement).value).toBe("uae");
    expect((screen.getByTestId("branch-link") as HTMLInputElement).checked).toBe(true);
    await act(async () => { fireEvent.click(screen.getByTestId("save-company")); });
    expect(save).toHaveBeenCalledOnce();
    const payload = JSON.parse(String(save.mock.calls[0][1].body));
    expect(payload).toMatchObject({
      countryId: "uae", addressCountryId: "india", countryName: "India", cityId: "mumbai",
      cityName: "Mumbai", districtId: null, areaLocationId: null, baseCurrency: "AED",
      zipCode: "00123", address: "Street line",
    });
    expect(payload).not.toHaveProperty("linkedCityBranchIds");

    unmount();
    render(<CompanyIncorporationForm initialCompanyId="fixture" />);
    await waitFor(() => expect(screen.getByTestId("address-country").textContent).toBe("india"));
    expect((screen.getByTestId("country") as HTMLSelectElement).value).toBe("uae");
  });
});

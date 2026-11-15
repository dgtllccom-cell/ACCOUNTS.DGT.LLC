import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";

// The vitest JSX transform is classic: the page component has no React import, so expose it globally.
Object.assign(globalThis, { React });

/**
 * Saved Country Main Branch "Pakistan Main Branch" (5269c1cb-…), with the same response shapes the DEV server
 * returns: the location and master-data routes wrap their payload as { ok, data }; the branch routes return the
 * payload directly; the company and customer routes wrap as { ok, data: { company | customer } }.
 */
const EDIT_ID = "5269c1cb-92a1-4aa8-aad8-d4c7260badaa";
const PK = "fb021716-a2e7-4141-9c1a-bd1ddd92eb14";
const BALOCHISTAN = "e8ee3215-8adb-4a0a-b75b-53b452de4da2";
const QUETTA = "74a8a33c-f272-46db-be46-8bb23d987c00";
const COMPANY_ID = "633fa062-d3e9-492a-bdd3-8561d7a77599";
const OWNER_ID = "c1b1cd6c-5d97-4f9a-a7e0-df0e0a566e2b";

const COUNTRIES = [
  { id: "8366fa0e-dcf6-4acd-8602-2819f103dd63", name: "Afghanistan", iso2: "AF", iso3: "AFG", currency_code: "AFN", phone_code: "+93", is_active: true },
  { id: PK, name: "Pakistan", iso2: "PK", iso3: "PAK", currency_code: "PKR", phone_code: "+92", is_active: true }
];
const STATES = [{ id: BALOCHISTAN, country_id: PK, name: "Balochistan", code: "PK-BA", postal_code: null, phone_area_code: null, is_active: true }];
const CITIES = [{ id: QUETTA, country_id: PK, state_province_id: BALOCHISTAN, district_id: null, name: "Quetta", code: "UET", zip_code: "87300", phone_area_code: "081", is_active: true }];

const COMPANY = {
  id: COMPANY_ID,
  company_code: "COMP-000156",
  name: "ASMATULLAH RETAIL SHOP",
  legal_name: "ASMATULLAH RETAIL SHOP",
  base_currency: "PKR",
  owner_person_id: OWNER_ID,
  country_id: PK,
  state_province_id: BALOCHISTAN,
  city_id: QUETTA,
  country_name: "Pakistan",
  state_name: "Balochistan",
  city_name: "Quetta",
  tax_number: null,
  registration_number: null,
  address: "HAZAR, GANJI, QUETTA, Quetta",
  contacts: [
    { type: "email", value: "dgt****@gm***.com", isPrimary: true },
    { type: "cell", value: "00923**776**88", isPrimary: true }
  ]
};

const CUSTOMER = {
  id: OWNER_ID,
  country_id: "8366fa0e-dcf6-4acd-8602-2819f103dd63",
  customer_name: "Asmatullah Abdullah",
  original_customer_name: "Asmatullah Abdullah",
  person_code: "PER-000208",
  company_name: null,
  contact_person: null,
  mobile: null,
  whatsapp: null,
  email: null,
  address: "-"
};

const RECORD = {
  id: EDIT_ID,
  country_id: PK,
  operational_domain: "business",
  name: "Pakistan Main Branch",
  code: "PAK-MAIN-001",
  local_currency: "PKR",
  is_main: true,
  status: "active",
  state_province_id: BALOCHISTAN,
  district_id: null,
  city_id: QUETTA,
  address: "Hazar Ganji, Quetta",
  phone: "923337764088",
  email: "anitciq@gmail.com",
  whatsapp_number: "923168000339",
  company_id: COMPANY_ID,
  owner_name: "Asmatullah Abdullah",
  owner_customer_id: OWNER_ID,
  owner_profile_id: null,
  contacts: [
    { type: "Phone", value: "923337764088" },
    { type: "WhatsApp", value: "923168000339" }
  ],
  documents: [],
  permission_template: "country-standard",
  permission_grants: ["dashboard.access", "branch.new_entry"],
  created_at: "2026-07-14T12:23:56.655Z",
  updated_at: "2026-09-29T19:15:29.658Z"
};

const DETAIL = {
  location: { countryName: "Pakistan", countryIso2: "PK", countryIso3: "PAK", countryCurrency: "PKR", countryPhoneCode: "+92", stateName: "Balochistan", districtName: "", cityName: "Quetta", cityCode: "UET", cityZip: "87300", areaName: "", areaPostal: "" },
  // The saved company and owner rows, as the server reads them from the company and customer tables.
  company: COMPANY,
  owner: CUSTOMER,
  ownerSource: "customer",
  linkedUsers: [],
  linkedDocuments: [],
  createdByName: ""
};

function apiOk(data: unknown) {
  return new Response(JSON.stringify({ ok: true, data }), { status: 200, headers: { "content-type": "application/json" } });
}
function plain(body: unknown) {
  return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
}

/** `liveFails`: the company, customer and bank endpoints answer 500, as if unavailable; the saved record must still show them. */
function installFetch(liveFails = false) {
  const fail = () => new Response(JSON.stringify({ ok: false, error: { code: "INTERNAL", message: "unavailable" } }), { status: 500, headers: { "content-type": "application/json" } });
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: unknown) => {
      const url = String(input);
      if (url.includes("/api/erp/locations/countries")) return apiOk({ countries: COUNTRIES });
      if (url.includes("/api/erp/locations/states")) return apiOk({ states: STATES });
      if (url.includes("/api/erp/locations/cities")) return apiOk({ cities: CITIES });
      if (url.includes("/api/erp/locations/districts")) return apiOk({ districts: [] });
      if (url.includes("/api/erp/locations/areas")) return apiOk({ areas: [] });
      if (liveFails && url.includes(`/api/erp/companies/${COMPANY_ID}`)) return fail();
      if (liveFails && url.includes(`/api/erp/customers/${OWNER_ID}`)) return fail();
      if (url.includes(`/api/erp/companies/${COMPANY_ID}/bank-accounts`)) return apiOk({ banks: [] });
      if (url.includes(`/api/erp/companies/${COMPANY_ID}`)) return apiOk({ company: COMPANY });
      if (url.includes(`/api/erp/customers/${OWNER_ID}`)) return apiOk({ customer: CUSTOMER });
      if (url.includes("/api/erp/companies")) return apiOk({ companies: [] });
      if (url.includes("/api/erp/customers")) return apiOk({ customers: [] });
      if (url.includes("/api/branch-management/country-branches") && url.includes("detail=1")) {
        return plain({ countryBranches: [RECORD], detail: DETAIL, detailError: null });
      }
      if (url.includes("/api/branch-management/country-branches")) return plain({ countryBranches: [RECORD] });
      return apiOk({});
    })
  );
}

/** Visible text of every button on the page (the location selects are buttons showing the selected label). */
function selectTriggerTexts(): string[] {
  return Array.from(document.querySelectorAll("button")).map((b) => (b.textContent || "").trim());
}

async function renderWithSearch(search: string) {
  vi.doMock("next/navigation", () => ({
    useSearchParams: () => new URLSearchParams(search),
    useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
    usePathname: () => "/dashboard/new-entry/branch-entry/country-branch"
  }));
  vi.doMock("@/lib/i18n/use-active-language", () => ({ useActiveLanguage: () => "en" }));
  const { CountryBranchSetup } = await import("@/features/branches/components/country-branch-setup");
  return render(<CountryBranchSetup />);
}

describe("Country Main Branch: saved record names for country, state, city and company", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("selects the saved country, state and city and loads the saved company", async () => {
    installFetch();
    await renderWithSearch(`editId=${EDIT_ID}`);

    await waitFor(() => expect(screen.queryByText("Loading existing branch for edit...")).toBeNull(), { timeout: 20000 });
    // The location selects (their trigger buttons) show the saved names, not their placeholders.
    await waitFor(() => expect(selectTriggerTexts()).toContain("Pakistan"), { timeout: 20000 });
    await waitFor(() => expect(selectTriggerTexts().some((t) => t.startsWith("Balochistan"))).toBe(true), { timeout: 20000 });
    await waitFor(() => expect(selectTriggerTexts().some((t) => t.startsWith("Quetta"))).toBe(true), { timeout: 20000 });
    expect(screen.queryByText("Select country first")).toBeNull();
    expect(screen.queryByText("Select country")).toBeNull();
    // The company loaded from its saved record.
    await waitFor(() => expect(screen.getAllByText(/ASMATULLAH RETAIL SHOP/).length).toBeGreaterThan(0), { timeout: 20000 });
  }, 40000);

  it("the saved company and owner still show when the live company and customer endpoints are unavailable", async () => {
    installFetch(true);
    await renderWithSearch(`editId=${EDIT_ID}&step=9`);

    await waitFor(() => expect(screen.queryByText("Loading existing branch for edit...")).toBeNull(), { timeout: 20000 });
    await waitFor(() => expect(screen.getAllByText("ASMATULLAH RETAIL SHOP").length).toBeGreaterThan(0), { timeout: 20000 });
    expect(screen.getAllByText("Balochistan").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Quetta").length).toBeGreaterThan(0);
  }, 40000);

  it("the live report shows the saved owner and company, not [Not Configured]", async () => {
    installFetch();
    await renderWithSearch(`editId=${EDIT_ID}`);

    await waitFor(() => expect(screen.queryByText("Loading existing branch for edit...")).toBeNull(), { timeout: 20000 });
    await waitFor(() => expect(screen.getAllByText("Asmatullah Abdullah").length).toBeGreaterThan(0), { timeout: 20000 });
    expect(screen.getAllByText("ASMATULLAH RETAIL SHOP").length).toBeGreaterThan(0);
    expect(screen.getAllByText("PER-000208").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Balochistan").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Quetta").length).toBeGreaterThan(0);
    // The company has no tax number or registration on the saved row: its live value stays the dash, never an invented number.
    expect(screen.queryByText("1234567-8")).toBeNull();
  }, 40000);

  it("the final review shows the saved country, state, city and company", async () => {
    installFetch();
    await renderWithSearch(`editId=${EDIT_ID}&step=9`);

    await waitFor(() => expect(screen.queryByText("Loading existing branch for edit...")).toBeNull(), { timeout: 20000 });
    await waitFor(() => expect(screen.getAllByText("Balochistan").length).toBeGreaterThan(0), { timeout: 20000 });
    expect(screen.getAllByText("Quetta").length).toBeGreaterThan(0);
    expect(screen.getAllByText("ASMATULLAH RETAIL SHOP").length).toBeGreaterThan(0);
  }, 40000);
});

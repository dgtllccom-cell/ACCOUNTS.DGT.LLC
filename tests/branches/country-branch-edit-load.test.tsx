import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";

// The vitest JSX transform is classic: the page component has no React import, so expose it globally.
Object.assign(globalThis, { React });

const EDIT_ID = "5269c1cb-92a1-4aa8-aad8-d4c7260badaa";

// The search string the mocked useSearchParams returns; a test can change it between renders.
let currentSearch = `editId=${EDIT_ID}`;

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(currentSearch),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/dashboard/new-entry/branch-entry/country-branch"
}));
vi.mock("@/lib/i18n/use-active-language", () => ({ useActiveLanguage: () => "en" }));

const ROW = {
  id: EDIT_ID,
  country_id: "fb021716-a2e7-4141-9c1a-bd1ddd92eb14",
  operational_domain: "business",
  name: "Pakistan Main Branch",
  code: "PAK-MAIN-001",
  local_currency: "PKR",
  is_main: true,
  status: "active",
  state_province_id: "e8ee3215-8adb-4a0a-b75b-53b452de4da2",
  district_id: null,
  city_id: "74a8a33c-f272-46db-be46-8bb23d987c00",
  address: "Hazar Ganji, Quetta",
  phone: "923337764088",
  email: "anitciq@gmail.com",
  whatsapp_number: "923168000339",
  company_id: "633fa062-d3e9-492a-bdd3-8561d7a77599",
  owner_name: "najee ullah",
  owner_customer_id: "c1b1cd6c-5d97-4f9a-a7e0-df0e0a566e2b",
  owner_profile_id: null,
  contacts: [],
  documents: [],
  permission_template: "country-standard",
  permission_grants: ["dashboard.access"],
  created_at: "2026-07-14T12:23:56.655Z",
  updated_at: "2026-09-29T19:15:29.658Z"
};

const DETAIL = {
  location: { countryName: "Pakistan", countryIso2: "PK", countryIso3: "PAK", countryCurrency: "PKR", countryPhoneCode: "+92", stateName: "Balochistan", districtName: "", cityName: "Quetta", cityCode: "", cityZip: "", areaName: "", areaPostal: "" },
  linkedUsers: [],
  linkedDocuments: [],
  createdByName: ""
};

function json(body: unknown) {
  return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
}

/** Installs fetch. The GET for the saved record waits on `release` when `holdRecordGet` is true. */
function installFetch(holdRecordGet: boolean) {
  const calls: string[] = [];
  let release: (() => void) | null = null;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: unknown) => {
      const url = String(input);
      calls.push(url);
      if (url.includes("/api/branch-management/country-branches") && url.includes("detail=1")) {
        return json({ countryBranches: [ROW], detail: DETAIL, detailError: null });
      }
      if (url.includes("/api/branch-management/country-branches") && url.includes(`id=${EDIT_ID}`)) {
        if (holdRecordGet) await gate;
        return json({ countryBranches: [ROW] });
      }
      return json({});
    })
  );
  return { calls, release: () => release?.() };
}

describe("Country Main Branch: a saved record loads from ?editId", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    currentSearch = `editId=${EDIT_ID}`;
  });

  it("clears the loading text and puts the saved branch code into the form", async () => {
    const { calls } = installFetch(false);
    const { CountryBranchSetup } = await import("@/features/branches/components/country-branch-setup");
    render(<CountryBranchSetup />);
    await waitFor(() => expect(screen.queryByText("Loading existing branch for edit...")).toBeNull(), { timeout: 15000 });
    expect(calls.filter((u) => u.includes(`id=${EDIT_ID}`) && !u.includes("detail=1")).length).toBe(1);
    await waitFor(() => expect(screen.getAllByDisplayValue("PAK-MAIN-001").length).toBeGreaterThan(0), { timeout: 15000 });
  }, 30000);

  it("shows the saved record on the final review step (step=9)", async () => {
    currentSearch = `editId=${EDIT_ID}&step=9`;
    installFetch(false);
    const { CountryBranchSetup } = await import("@/features/branches/components/country-branch-setup");
    render(<CountryBranchSetup />);
    await waitFor(() => expect(screen.queryByText("Loading existing branch for edit...")).toBeNull(), { timeout: 15000 });
    await waitFor(() => expect(screen.getAllByText("Pakistan Main Branch").length).toBeGreaterThan(0), { timeout: 15000 });
    await waitFor(() => expect(screen.getAllByText("Hazar Ganji, Quetta").length).toBeGreaterThan(0), { timeout: 15000 });
    expect(screen.getAllByText(/of 20 Completed/).length).toBeGreaterThan(0);
  }, 30000);

  it("still loads the record when the page re-renders without editId while the record request is in flight", async () => {
    const { calls, release } = installFetch(true);
    const { CountryBranchSetup } = await import("@/features/branches/components/country-branch-setup");
    const view = render(<CountryBranchSetup />);
    // The GET for the record is now pending.
    await waitFor(() => expect(calls.filter((u) => u.includes(`id=${EDIT_ID}`) && !u.includes("detail=1")).length).toBe(1), { timeout: 15000 });
    expect(screen.getByText("Loading existing branch for edit...")).toBeTruthy();

    // A re-render without the query parameter (the effect is cleaned up mid-request).
    currentSearch = "";
    view.rerender(<CountryBranchSetup />);

    // The record response arrives after that.
    release();
    await waitFor(() => expect(screen.queryByText("Loading existing branch for edit...")).toBeNull(), { timeout: 15000 });
    await waitFor(() => expect(screen.getAllByDisplayValue("PAK-MAIN-001").length).toBeGreaterThan(0), { timeout: 15000 });
  }, 30000);
});

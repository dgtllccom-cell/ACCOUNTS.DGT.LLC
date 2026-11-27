import React from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { NewAccountSetup } from "@/features/accounts/components/new-account-setup";
import { apiPost } from "@/lib/api/client";

const { uae, india, state, city } = vi.hoisted(() => ({
  uae: { id: "ae", name: "United Arab Emirates", iso2: "AE", currency_code: "AED", is_active: true },
  india: { id: "in", name: "India", iso2: "IN", currency_code: "INR", is_active: true },
  state: { id: "mh", name: "Maharashtra", code: "MH", country_id: "in", is_active: true },
  city: { id: "mum", name: "Mumbai", code: "MUM", country_id: "in", state_province_id: "mh", zip_code: "400001", is_active: true },
}));
vi.stubGlobal("React", React);
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/lib/i18n/use-active-language", () => ({ useActiveLanguage: () => "en" }));
vi.mock("@/lib/hooks/use-erp-scope", () => ({ useErpScope: () => ({
  loading: false, isSuperAdmin: true, roles: [], countryIds: [], mode: "super_admin",
  operationalDomains: ["business", "shipping"], company: null,
}) }));
vi.mock("@/lib/api/client", () => ({ apiGet: vi.fn(), apiPost: vi.fn(), apiPatch: vi.fn() }));
vi.mock("@/lib/branding/client", () => ({ fetchBranding: vi.fn().mockResolvedValue({}) }));
vi.mock("@/features/locations/location-api", () => ({
  invalidateLocationCache: vi.fn(),
  listCountries: vi.fn(async (params?: { all?: boolean }) => params?.all ? [uae, india] : [uae]),
  listStates: vi.fn(async ({ countryId }: { countryId: string }) => countryId === "in" ? [state] : []),
  listCities: vi.fn(async ({ countryId }: { countryId: string }) => countryId === "in" ? [city] : []),
}));

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it("keeps Dubai ownership and the draft while selecting foreign Location Management entries inline", async () => {
  vi.stubGlobal("fetch", vi.fn(async (input: string) => ({
    json: async () => input.includes("/branches/city")
      ? { data: { cityBranches: [{ id: "dubai", name: "Dubai City Branch", code: "ARE-AEDU-001" }] } }
      : { ok: true, data: {} },
  })));
  render(<NewAccountSetup initialCountryId="ae" initialBranchId="dubai" initialBranchType="City" />);
  const source = (id: string) => document.getElementById(id) as HTMLSelectElement;
  const address = source("addressCountry");
  const accountName = screen.getByRole("textbox", { name: /^Account Name/i }) as HTMLInputElement;
  fireEvent.change(accountName, { target: { value: "Unfinished draft" } });
  const postal = screen.getByRole("textbox", { name: /ZIP.*Postal Code/i }) as HTMLInputElement;
  fireEvent.change(postal, { target: { value: "400999" } });
  await waitFor(() => expect(within(address).getByRole("option", { name: /India/ })).toBeTruthy());
  const ownership = screen.getAllByRole("combobox", { name: /^Country \*/i }).find((entry) => entry !== address) as HTMLSelectElement;
  const branch = screen.getByRole("combobox", { name: /City Branch/i }) as HTMLSelectElement;
  await waitFor(() => expect(branch.value).toBe("dubai"));
  expect(ownership.value).toBe("ae");
  expect(within(ownership).queryByRole("option", { name: /India/ })).toBeNull();

  fireEvent.click(screen.getByRole("button", { name: "New Country" }));
  fireEvent.change(screen.getByLabelText(/Country Name/i), { target: { value: "India" } });
  fireEvent.change(screen.getByLabelText(/ISO2/i), { target: { value: "IN" } });
  fireEvent.click(screen.getByRole("button", { name: /Save Country/i }));
  await waitFor(() => expect(address.value).toBe("in"));

  fireEvent.click(screen.getByRole("button", { name: "New State" }));
  fireEvent.change(screen.getByLabelText(/State.*Name/i), { target: { value: "Maharashtra" } });
  fireEvent.click(screen.getByRole("button", { name: /Save State/i }));
  await waitFor(() => expect(source("addressState").value).toBe("mh"));

  fireEvent.click(screen.getByRole("button", { name: "New City" }));
  fireEvent.change(screen.getByLabelText(/City.*Name/i), { target: { value: "Mumbai" } });
  fireEvent.click(screen.getByRole("button", { name: /Save City/i }));
  await waitFor(() => expect(source("addressCity").value).toBe("mum"));
  expect(accountName.value).toBe("Unfinished draft");
  expect(postal.value).toBe("400999");
  expect(ownership.value).toBe("ae");
  expect(branch.value).toBe("dubai");
  expect(apiPost).not.toHaveBeenCalled();
});

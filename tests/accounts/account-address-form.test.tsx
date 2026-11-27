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
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  HTMLElement.prototype.scrollIntoView = vi.fn();
  render(<NewAccountSetup initialCountryId="ae" initialBranchId="dubai" initialBranchType="City" />);
  const country = () => screen.getByRole<HTMLButtonElement>("button", { name: "Country" });
  const province = () => screen.getByRole<HTMLButtonElement>("button", { name: /State.*Province/i });
  const cityDropdown = () => screen.getByRole<HTMLButtonElement>("button", { name: "City" });
  const openNew = async (trigger: () => HTMLButtonElement, name: string) => {
    await waitFor(() => expect(trigger().disabled).toBe(false));
    expect(screen.queryByRole("button", { name })).toBeNull();
    fireEvent.click(trigger());
    const popup = screen.getByRole("dialog");
    fireEvent.click(within(popup).getByRole("button", { name }));
  };
  const accountName = screen.getByRole("textbox", { name: /^Account Name/i }) as HTMLInputElement;
  fireEvent.change(accountName, { target: { value: "Unfinished draft" } });
  const postal = screen.getByRole("textbox", { name: /ZIP.*Postal Code/i }) as HTMLInputElement;
  fireEvent.change(postal, { target: { value: "400999" } });
  const ownership = screen.getByRole("combobox", { name: /^Country \*/i }) as HTMLSelectElement;
  const branch = screen.getByRole("combobox", { name: /City Branch/i }) as HTMLSelectElement;
  await waitFor(() => expect(branch.value).toBe("dubai"));
  expect(ownership.value).toBe("ae");
  expect(within(ownership).queryByRole("option", { name: /India/ })).toBeNull();

  await openNew(country, "New Country");
  fireEvent.change(screen.getByLabelText(/Country Name/i), { target: { value: "India" } });
  fireEvent.change(screen.getByLabelText(/ISO2/i), { target: { value: "IN" } });
  fireEvent.click(screen.getByRole("button", { name: /Save Country/i }));
  await waitFor(() => expect(country().textContent).toContain("India (IN)"));

  await openNew(province, "New State");
  fireEvent.change(screen.getByLabelText(/State.*Name/i), { target: { value: "Maharashtra" } });
  fireEvent.change(screen.getByLabelText(/State.*Code/i), { target: { value: "MH" } });
  fireEvent.click(screen.getByRole("button", { name: /Save State/i }));
  await waitFor(() => expect(province().textContent).toContain("Maharashtra (MH)"));

  await openNew(cityDropdown, "New City");
  fireEvent.change(screen.getByLabelText(/City.*Name/i), { target: { value: "Mumbai" } });
  fireEvent.change(screen.getByLabelText(/City.*Code/i), { target: { value: "MUM" } });
  fireEvent.click(screen.getByRole("button", { name: /Save City/i }));
  await waitFor(() => expect(cityDropdown().textContent).toContain("Mumbai (MUM)"));
  expect(accountName.value).toBe("Unfinished draft");
  expect(postal.value).toBe("400999");
  expect(ownership.value).toBe("ae");
  expect(branch.value).toBe("dubai");
  expect(apiPost).not.toHaveBeenCalled();
});

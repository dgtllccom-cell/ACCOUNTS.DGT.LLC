import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { activeAddressChoices, findAddressDuplicate } from "@/features/accounts/components/account-address-locations";
import { LocationQuickCreateModal } from "@/features/locations/components/location-hierarchy-select";
import { apiPost } from "@/lib/api/client";

vi.stubGlobal("React", React);
vi.mock("@/lib/api/client", () => ({ apiGet: vi.fn(), apiPost: vi.fn() }));
vi.mock("@/lib/i18n/use-active-language", () => ({ useActiveLanguage: () => "en" }));
beforeEach(() => vi.resetAllMocks());
afterEach(cleanup);

const country = { id: "in", name: "India", iso2: "IN", iso3: "IND", currency_code: "INR",
  default_language_code: "en", phone_code: "+91", is_active: true };
const city = { id: "mum", name: "Mumbai", code: "MUM", country_id: "in",
  state_province_id: "mh", district_id: null, zip_code: null, phone_area_code: null, is_active: true };

describe("Account address location choices", () => {
  it("does not accept country-wide city fallback rows from another province", () => {
    expect(activeAddressChoices([city, { ...city, id: "other", state_province_id: "dl" },
      { ...city, id: "wrong-country", country_id: "pk" }, { ...city, id: "inactive", is_active: false }],
    "in", "mh").map((r) => r.id)).toEqual(["mum"]);
  });
  it("reuses an exact normalized code or name", () => {
    expect(findAddressDuplicate([country], "بھارت", "in", true)).toBe(country);
    expect(findAddressDuplicate([city], "  MUMBAI ", "", false)).toBe(city);
    expect(findAddressDuplicate([country], "India", "XX", true)).toBeNull();
  });
});

describe("Account address quick create dialog", () => {
  it("selects a duplicate without posting a new location or saving the parent form", async () => {
    const onCreated = vi.fn();
    const resolveExisting = vi.fn().mockResolvedValue(country);
    render(<LocationQuickCreateModal type="country" requireCountryMetadata onClose={vi.fn()}
      onCreated={onCreated} resolveExisting={resolveExisting}/>);
    fireEvent.change(screen.getByLabelText(/Country Name/i), { target: { value: "India" } });
    fireEvent.change(screen.getByLabelText(/ISO2/i), { target: { value: "IN" } });
    fireEvent.click(screen.getByRole("button", { name: /Save Country/i }));
    await waitFor(() => expect(onCreated).toHaveBeenCalledWith("in", country));
    expect(apiPost).not.toHaveBeenCalled();
  });

  it("opens the selected country/state, writes through the existing city route, and waits for readback", async () => {
    const onCreated = vi.fn();
    let complete!: (value: typeof city) => void;
    const confirmSaved = vi.fn().mockReturnValue(new Promise((resolve) => { complete = resolve; }));
    vi.mocked(apiPost).mockResolvedValue({ city });
    render(<LocationQuickCreateModal type="city" countryId="in" stateProvinceId="mh"
      countryName="India" stateName="Maharashtra" onClose={vi.fn()} onCreated={onCreated} confirmSaved={confirmSaved}/>);
    fireEvent.change(screen.getByLabelText(/City.*Name/i), { target: { value: "Mumbai" } });
    fireEvent.click(screen.getByRole("button", { name: /Save City/i }));
    await waitFor(() => expect(apiPost).toHaveBeenCalledWith("/api/erp/locations/cities",
      expect.objectContaining({ countryId: "in", stateProvinceId: "mh", name: "Mumbai" })));
    expect(onCreated).not.toHaveBeenCalled();
    complete(city);
    await waitFor(() => expect(onCreated).toHaveBeenCalledWith("mum", city));
  });

  it("keeps the dialog and does not select a location when readback fails", async () => {
    const onCreated = vi.fn();
    vi.mocked(apiPost).mockResolvedValue({ city });
    render(<LocationQuickCreateModal type="city" countryId="in" stateProvinceId="mh"
      onClose={vi.fn()} onCreated={onCreated} confirmSaved={vi.fn().mockRejectedValue(new Error("Location not found after save"))}/>);
    fireEvent.change(screen.getByLabelText(/City.*Name/i), { target: { value: "Mumbai" } });
    fireEvent.click(screen.getByRole("button", { name: /Save City/i }));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("Location not found after save"));
    expect(onCreated).not.toHaveBeenCalled();
  });
});

import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { LocationQuickCreateModal } from "@/features/locations/components/location-hierarchy-select";
import { apiPost } from "@/lib/api/client";
vi.stubGlobal("React", React);
vi.mock("@/lib/api/client", () => ({ apiGet: vi.fn(), apiPost: vi.fn(), apiPatch: vi.fn(), apiDelete: vi.fn() }));
vi.mock("@/lib/i18n/use-active-language", () => ({ useActiveLanguage: () => "en" }));

beforeEach(() => {
  vi.clearAllMocks();
});
afterEach(cleanup);

describe("New Area dialog", () => {
  it("shows the required-name message beside Save Area and sends nothing when the name is empty", () => {
    render(
      <LocationQuickCreateModal
        type="area"
        countryId="country-1"
        stateProvinceId="state-1"
        cityId="city-1"
        countryName="Pakistan"
        stateName="Balochistan"
        cityName="Quetta"
        onClose={() => {}}
        onCreated={() => {}}
      />
    );
    expect(screen.getByRole("alert").textContent).not.toContain("Area name is required.");
    fireEvent.click(screen.getByRole("button", { name: /Save Area/i }));
    expect(screen.getByRole("alert").textContent).toContain("Area name is required.");
    expect(apiPost).not.toHaveBeenCalled();
  });
});

import React, { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { emptyExternalLocation, ExternalLocationPicker } from "@/app/ext/form/[token]/external-location-picker";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function Fixture() {
  const [selection, setSelection] = useState(emptyExternalLocation);
  return <><ExternalLocationPicker token="fixture" lang="en" value={selection} onChange={setSelection} />
    <output data-testid="picked">{[selection.country?.id, selection.state?.id, selection.city?.id].join("/")}</output></>;
}

describe("external Location Management picker", () => {
  it("loads cities from the selected parents and clears a previously selected city when country changes", async () => {
    vi.stubGlobal("React", React);
    const country = [{ id: "india", name: "India" }, { id: "uae", name: "UAE" }];
    const state = [{ id: "maharashtra", name: "Maharashtra" }];
    const city = [{ id: "mumbai", name: "Mumbai", postalCode: "400001" }];
    const fetch = vi.fn(async (url: string) => {
      const query = new URL(url, "http://localhost").searchParams;
      const kind = query.get("kind");
      const choices = kind === "country" ? country :
        kind === "state" && query.get("countryId") === "india" ? state :
        kind === "city" && query.get("stateProvinceId") === "maharashtra" ? city : [];
      return { ok: true, json: async () => ({ choices }) };
    });
    vi.stubGlobal("fetch", fetch);
    render(<Fixture />);
    await screen.findByRole("option", { name: "India" });
    fireEvent.change(screen.getByLabelText(/Country/), { target: { value: "india" } });
    await screen.findByRole("option", { name: "Maharashtra" });
    fireEvent.change(screen.getByLabelText(/State/), { target: { value: "maharashtra" } });
    await screen.findByRole("option", { name: "Mumbai" });
    fireEvent.change(screen.getByLabelText(/City/), { target: { value: "mumbai" } });
    expect(screen.getByTestId("picked").textContent).toBe("india/maharashtra/mumbai");
    fireEvent.change(screen.getByLabelText(/Country/), { target: { value: "uae" } });
    await waitFor(() => expect(screen.getByTestId("picked").textContent).toBe("uae//"));
    expect(screen.queryByRole("option", { name: "Mumbai" })).toBeNull();
  });
});

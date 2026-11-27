import React, { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NativeSearchSelect, routeMasterResponse } from "./route-fixtures";

vi.mock("@/lib/i18n/use-active-language", () => ({ useActiveLanguage: () => "en" }));
vi.mock("@/components/ui/search-select", () => ({ SearchSelect: (p: any) => NativeSearchSelect(p) }));

import {
  BookingRouteFields,
  matchCountry,
  resetRouteCountryCache,
  shippingModeToLegMode,
  type RouteLeg,
} from "@/features/location-master/components/booking-route-fields";

const reads: string[] = [];
beforeEach(() => {
  reads.length = 0;
  resetRouteCountryCache();
  vi.stubGlobal("React", React);
  vi.stubGlobal("fetch", vi.fn(async (input: string, init?: RequestInit) => {
    if (init?.method && init.method !== "GET") throw new Error("No database writes in this test");
    reads.push(input);
    return new Response(JSON.stringify({ ok: true, data: routeMasterResponse(input) || {} }), { status: 200 });
  }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

function Harness({ initial, mode, onLeg }: { initial: RouteLeg; mode: string; onLeg: (leg: RouteLeg) => void }) {
  const [leg, setLeg] = useState(initial);
  return <BookingRouteFields side="loading" shippingMode={mode} testId="route" value={leg}
    onChange={(next) => { onLeg(next); setLeg(next); }} />;
}
const empty: RouteLeg = { countryId: "", countryName: "", locationId: "", locationName: "" };

describe("shippingModeToLegMode", () => {
  it.each([
    ["By Sea", "by_sea"], ["By Ship", "by_sea"], ["", "by_sea"], [undefined, "by_sea"],
    ["By Road", "by_road"], ["Truck", "by_road"], ["local", "by_road"],
    ["By Air", "by_air"], ["By Rail", "by_rail"], ["By Train", "by_rail"],
  ])("maps %s → %s", (mode, leg) => expect(shippingModeToLegMode(mode as string)).toBe(leg));
});

describe("matchCountry", () => {
  const list = [{ id: "c-ae", name: "United Arab Emirates", iso2: "AE", iso3: "ARE" }];
  it("prefers the id, then name, ISO code or localized name", () => {
    expect(matchCountry(list, { id: "c-ae", name: "x" })?.id).toBe("c-ae");
    expect(matchCountry(list, { name: " united arab emirates " })?.id).toBe("c-ae");
    expect(matchCountry(list, { name: "AE" })?.id).toBe("c-ae");
    expect(matchCountry(list, { name: "متحدہ عرب امارات" }, { "c-ae": "متحدہ عرب امارات" })?.id).toBe("c-ae");
    expect(matchCountry(list, { name: "Nowhere" })).toBeUndefined();
  });
});

describe("BookingRouteFields", () => {
  it("By Sea: country → its seaports; selecting saves name + id; changing country clears the port", async () => {
    const onLeg = vi.fn();
    render(<Harness initial={empty} mode="By Sea" onLeg={onLeg} />);
    const country = await screen.findByLabelText("Loading Country") as HTMLSelectElement;
    await waitFor(() => expect(country.options.length).toBe(3));
    fireEvent.change(country, { target: { value: "c-ae" } });
    expect(onLeg).toHaveBeenLastCalledWith({ countryId: "c-ae", countryName: "United Arab Emirates", locationId: "", locationName: "" });

    const port = screen.getByLabelText("Loading Port") as HTMLSelectElement;
    await waitFor(() => expect(Array.from(port.options).map((o) => o.text)).toContain("Jebel Ali Port"));
    expect(reads.some((u) => u.includes("type=seaport") && u.includes("countryId=c-ae"))).toBe(true);
    expect(reads.some((u) => u.includes("type=land_border"))).toBe(false);
    fireEvent.change(port, { target: { value: "l-jea" } });
    expect(onLeg).toHaveBeenLastCalledWith({ countryId: "c-ae", countryName: "United Arab Emirates", locationId: "l-jea", locationName: "Jebel Ali Port" });

    fireEvent.change(country, { target: { value: "c-pk" } });
    expect(onLeg).toHaveBeenLastCalledWith({ countryId: "c-pk", countryName: "Pakistan", locationId: "", locationName: "" });
    await waitFor(() => expect(Array.from((screen.getByLabelText("Loading Port") as HTMLSelectElement).options).map((o) => o.text)).toContain("Karachi Port"));
  });

  it("By Road: the same country lists its land borders under a Border label", async () => {
    render(<Harness initial={{ ...empty, countryId: "c-pk", countryName: "Pakistan" }} mode="By Road" onLeg={vi.fn()} />);
    const border = await screen.findByLabelText("Loading Border") as HTMLSelectElement;
    await waitFor(() => expect(Array.from(border.options).map((o) => o.text)).toContain("Torkham Border"));
    expect(Array.from(border.options).map((o) => o.text)).not.toContain("Karachi Port");
    expect(screen.getByTestId("route").getAttribute("data-route-mode")).toBe("by_road");
  });

  it("legacy name-only booking: preselects by name and stores the ids without renaming", async () => {
    const onLeg = vi.fn();
    render(<Harness initial={{ ...empty, countryName: "united arab emirates", locationName: "Jebel Ali Port" }} mode="By Sea" onLeg={onLeg} />);
    await waitFor(() => expect(onLeg).toHaveBeenCalledWith(expect.objectContaining({ countryId: "c-ae", locationId: "l-jea" })));
    const last = onLeg.mock.calls.at(-1)![0];
    expect(last).toEqual({ countryId: "c-ae", countryName: "united arab emirates", locationId: "l-jea", locationName: "Jebel Ali Port" });
    expect((screen.getByLabelText("Loading Country") as HTMLSelectElement).value).toBe("c-ae");
    expect((screen.getByLabelText("Loading Port") as HTMLSelectElement).value).toBe("l-jea");
  });

  it("legacy names missing from the master still display and are not overwritten", async () => {
    const onLeg = vi.fn();
    render(<Harness initial={{ ...empty, countryName: "United Arab Emirates", locationName: "Old Creek Wharf" }} mode="By Sea" onLeg={onLeg} />);
    const port = await screen.findByLabelText("Loading Port") as HTMLSelectElement;
    await waitFor(() => expect(Array.from(port.options).map((o) => o.text)).toContain("Jebel Ali Port"));
    expect(port.selectedOptions[0].text).toBe("Old Creek Wharf");
    for (const [leg] of onLeg.mock.calls) expect(leg.locationName).toBe("Old Creek Wharf");
  });
});

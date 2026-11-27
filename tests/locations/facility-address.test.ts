import { describe, expect, it } from "vitest";
import { composeFacilityAddress, splitFacilityAddress } from "@/features/clearing-agent/facility-address";

describe("facility (delivery) address text", () => {
  it("joins the detail and the master place line", () => {
    expect(composeFacilityAddress({ detail: "Plot 7, Gate 4", city: "Karachi", state: "Sindh", postalCode: "74000", country: "Pakistan" }))
      .toBe("Plot 7, Gate 4 | Karachi, Sindh, 74000, Pakistan");
  });

  it("reopening returns only the detail, so re-saving never duplicates the place line", () => {
    const saved = composeFacilityAddress({ detail: "Plot 7", city: "Karachi", country: "Pakistan" });
    const { detail, place } = splitFacilityAddress(saved);
    expect(detail).toBe("Plot 7");
    expect(place).toBe("Karachi, Pakistan");
    expect(composeFacilityAddress({ detail, fallbackPlaceLine: place })).toBe(saved);
  });

  it("keeps older free-text rows unchanged", () => {
    expect(splitFacilityAddress("Old yard, Port Qasim")).toEqual({ detail: "Old yard, Port Qasim", place: "" });
    expect(composeFacilityAddress({ detail: "Old yard, Port Qasim" })).toBe("Old yard, Port Qasim");
  });

  it("a user-typed separator cannot fake a place line", () => {
    expect(composeFacilityAddress({ detail: "A | B", city: "Dubai" })).toBe("A B | Dubai");
  });
});

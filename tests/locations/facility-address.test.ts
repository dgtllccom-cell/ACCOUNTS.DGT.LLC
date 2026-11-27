import { describe, expect, it } from "vitest";
import { formatFacilityAddress, savedFacilityPlace } from "@/features/clearing-agent/facility-address";

describe("facility display address", () => {
  it("reopens with the original detail and lets the postal code change without duplicating the place", () => {
    const detail = "Yard A | Gate 7";
    const display = formatFacilityAddress(detail, "Karachi, Sindh, Pakistan", "74000");
    const place = savedFacilityPlace(display, detail, "74000");
    expect(place).toBe("Karachi, Sindh, Pakistan");
    expect(formatFacilityAddress(detail, place, "75500")).toBe("Yard A | Gate 7 | Karachi, Sindh, Pakistan, 75500");
  });

  it("supports missing street text, missing place and legacy rows", () => {
    expect(savedFacilityPlace("Dubai, 00000", "", "00000")).toBe("Dubai");
    expect(savedFacilityPlace("00000", "", "00000")).toBe("");
    expect(savedFacilityPlace("Old yard | Gate 7")).toBe("");
  });
});

import { describe, expect, it } from "vitest";
import { postalCodeAfterCityChange } from "@/features/locations/address-postal-code";

describe("Location Management postal code suggestions", () => {
  it("fills the selected city's suggestion, then discards it when the parent clears the city", () => {
    const mumbai = postalCodeAfterCityChange("", "", "400001");
    expect(mumbai).toEqual({ value: "400001", suggestion: "400001" });
    expect(postalCodeAfterCityChange(mumbai.value, mumbai.suggestion, null)).toEqual({ value: "", suggestion: "" });
  });
  it("replaces an automatic code when a different city is selected", () => {
    expect(postalCodeAfterCityChange("400001", "400001", "110001")).toEqual({ value: "110001", suggestion: "110001" });
  });
  it("preserves a manual or legacy saved code when country, state or city changes", () => {
    expect(postalCodeAfterCityChange("00123", "", null)).toEqual({ value: "00123", suggestion: "" });
    expect(postalCodeAfterCityChange("00123", "", "110001")).toEqual({ value: "00123", suggestion: "" });
  });
});

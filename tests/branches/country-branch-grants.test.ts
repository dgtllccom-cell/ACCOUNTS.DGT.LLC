import { describe, expect, it } from "vitest";
import { countryGrantsForForm } from "@/features/branches/lib/country-branch-grants";
import { allPermissionGroupKeys, getPermissionKeysForTemplate } from "@/lib/permissions/catalog";

describe("countryGrantsForForm", () => {
  it("keeps valid catalog group keys and drops duplicates", () => {
    const [first] = allPermissionGroupKeys();
    const result = countryGrantsForForm([first, first], "country-standard");
    expect(result.grants).toEqual([first]);
    expect(result.prefilled).toBe(false);
    expect(result.unrecognised).toEqual([]);
  });

  it("reports expanded resource:action keys as unrecognised and keeps them out of the form", () => {
    const [first] = allPermissionGroupKeys();
    const result = countryGrantsForForm([first, "shipping:read", "city_branches:create"], "country-standard");
    expect(result.grants).toEqual([first]);
    expect(result.unrecognised).toEqual(["shipping:read", "city_branches:create"]);
    expect(result.prefilled).toBe(false);
  });

  it("pre-selects the template and flags it when the saved row has no grants (empty array)", () => {
    const result = countryGrantsForForm([], "country-standard");
    expect(result.prefilled).toBe(true);
    expect(result.grants).toEqual(getPermissionKeysForTemplate("country-standard"));
    expect(result.grants.length).toBeGreaterThan(0);
  });

  it("pre-selects the template when the stored grants are null, and treats a null template as country-standard", () => {
    const result = countryGrantsForForm(null, null);
    expect(result.prefilled).toBe(true);
    expect(result.grants).toEqual(getPermissionKeysForTemplate("country-standard"));
  });

  it("only the country-standard template keys are valid catalog group keys", () => {
    const valid = new Set(allPermissionGroupKeys());
    for (const key of getPermissionKeysForTemplate("country-standard")) {
      expect(valid.has(key)).toBe(true);
    }
  });
});

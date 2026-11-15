import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { permissionCatalog } from "@/lib/permissions/catalog";
import { buildPermissionPrintSummary } from "@/lib/reports/permission-print-summary";
import { parseJsonArray } from "@/lib/utils/parse-json-array";

const COUNTRY_ROUTE = path.resolve(process.cwd(), "app/api/branch-management/country-branches/route.ts");
const CITY_ROUTE = path.resolve(process.cwd(), "app/api/branch-management/city-branches/route.ts");

describe("parseJsonArray", () => {
  it("passes a real array through unchanged", () => {
    expect(parseJsonArray(["a", "b"])).toEqual(["a", "b"]);
  });

  it("parses a double-encoded (JSON string) value back into an array", () => {
    expect(parseJsonArray('["a","b"]')).toEqual(["a", "b"]);
  });

  it("returns an empty array for null, undefined, non-JSON and non-array JSON", () => {
    expect(parseJsonArray(null)).toEqual([]);
    expect(parseJsonArray(undefined)).toEqual([]);
    expect(parseJsonArray("not json")).toEqual([]);
    expect(parseJsonArray('{"a":1}')).toEqual([]);
    expect(parseJsonArray(42)).toEqual([]);
  });
});

describe("buildPermissionPrintSummary with stored grant shapes", () => {
  const keys = permissionCatalog.filter((p) => !p.hidden).slice(0, 2).map((p) => p.key);

  it("counts the same grants from an array and from a double-encoded string", () => {
    const fromArray = buildPermissionPrintSummary(keys, "country-standard");
    const fromString = buildPermissionPrintSummary(JSON.stringify(keys), "country-standard");
    expect(fromString.grantedCount).toBe(fromArray.grantedCount);
    expect(fromArray.grantedCount).toBe(keys.length);
  });

  it("never throws on an unexpected shape (the reported '.filter is not a function' crash)", () => {
    expect(() => buildPermissionPrintSummary("not-a-list" as unknown, null)).not.toThrow();
    expect(() => buildPermissionPrintSummary(undefined, null)).not.toThrow();
    expect(buildPermissionPrintSummary({ bad: true } as unknown, null).grantedCount).toBe(0);
  });
});

describe("branch routes persist JSON columns as real arrays", () => {
  it("country route never writes JSON via JSON.stringify(...)::jsonb", () => {
    const src = readFileSync(COUNTRY_ROUTE, "utf8");
    expect(src).not.toMatch(/JSON\.stringify\([^)]*\)\s*::jsonb/);
    expect(src).toMatch(/permission_grants = \$\{sql\.json\(/);
  });

  it("city route never writes JSON via JSON.stringify(...)::jsonb", () => {
    const src = readFileSync(CITY_ROUTE, "utf8");
    expect(src).not.toMatch(/JSON\.stringify\([^)]*\)\s*::jsonb/);
    expect(src).toMatch(/permission_grants = \$\{sql\.json\(/);
  });

  it("normalised fields come after the row spread in both GET normalisers", () => {
    for (const file of [COUNTRY_ROUTE, CITY_ROUTE]) {
      const src = readFileSync(file, "utf8");
      expect(src).toMatch(/\.\.\.row,\s*\n\s*permission_grants: parseJsonArray\(row\.permission_grants\)/);
    }
  });
});

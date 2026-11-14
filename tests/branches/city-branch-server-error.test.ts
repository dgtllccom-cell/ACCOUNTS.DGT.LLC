import { describe, expect, it } from "vitest";
import { describeCityBranchServerError, CITY_BRANCH_FIELD_KEYS } from "@/features/branches/lib/city-branch-server-error";

const label = (field: string) => `[${field}]`;

describe("describeCityBranchServerError", () => {
  it("returns a plain server message in full", () => {
    expect(describeCityBranchServerError({ error: "Country scope is not allowed." }, "fallback", label)).toBe("Country scope is not allowed.");
  });

  it("lists every rejected field with its field name (zod flatten form)", () => {
    const body = {
      error: {
        formErrors: [],
        fieldErrors: { email: ["Branch email is required"], permissionGrants: ["At least one permission is required"] }
      }
    };
    expect(describeCityBranchServerError(body, "fallback", label)).toBe(
      "[email]: Branch email is required\n[permissionGrants]: At least one permission is required"
    );
  });

  it("keeps form-level errors that have no field", () => {
    const body = { error: { formErrors: ["City is required"], fieldErrors: {} } };
    expect(describeCityBranchServerError(body, "fallback", label)).toBe("City is required");
  });

  it("uses the fallback only when the body has no message at all (empty)", () => {
    expect(describeCityBranchServerError({}, "fallback", label)).toBe("fallback");
    expect(describeCityBranchServerError(null, "fallback", label)).toBe("fallback");
    expect(describeCityBranchServerError({ error: { fieldErrors: {} } }, "fallback", label)).toBe("fallback");
  });

  it("reads a top-level message field", () => {
    expect(describeCityBranchServerError({ message: "Main branch not found." }, "fallback", label)).toBe("Main branch not found.");
  });

  it("maps every field the page can send to a dictionary key", () => {
    for (const key of ["countryId", "countryBranchId", "operationalDomain", "name", "code", "email", "permissionGrants", "contacts"]) {
      expect(CITY_BRANCH_FIELD_KEYS[key]).toMatch(/^cbs\.field_/);
    }
  });
});

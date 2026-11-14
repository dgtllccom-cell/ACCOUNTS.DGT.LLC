import { describe, expect, it } from "vitest";
import {
  getSuperAdminMissingFields,
  hasUsableMobileContact,
  isDialCodePlaceholder,
  pickSuperAdminPhone
} from "@/features/branch-management/validation";

const completeForm = {
  country: "United Arab Emirates",
  state: "Dubai",
  cityOrDistrict: "Dubai",
  company: "Damaan Global Trading LLC",
  owner: "Ali Khan",
  currency: "USD",
  address: "Al Maktoum Street, Deira"
};

describe("Super Admin Branch mobile requirement", () => {
  it("rejects an empty contact list", () => {
    expect(hasUsableMobileContact([])).toBe(false);
  });

  it("rejects the country prefill that holds only the dial code", () => {
    expect(hasUsableMobileContact([{ type: "Mobile Number", value: "+971" }])).toBe(false);
  });

  it("rejects a mobile row with too few digits", () => {
    expect(hasUsableMobileContact([{ type: "Mobile Number", value: "+971 5" }])).toBe(false);
  });

  it("accepts a real Mobile Number contact", () => {
    expect(hasUsableMobileContact([{ type: "Mobile Number", value: "+971 50 123 4567" }])).toBe(true);
  });

  it("does not count phone, WhatsApp or email rows as the mandatory mobile", () => {
    expect(
      hasUsableMobileContact([
        { type: "Phone Number", value: "+971 4 123 4567" },
        { type: "WhatsApp Number", value: "+971 50 123 4567" },
        { type: "Email Address", value: "ops@example.com" }
      ])
    ).toBe(false);
  });

  it("accepts a valid mobile even when another contact has the same value (values may repeat)", () => {
    expect(
      hasUsableMobileContact([
        { type: "Mobile Number", value: "+971501234567" },
        { type: "Mobile Number", value: "+971501234567" }
      ])
    ).toBe(true);
  });
});

describe("isDialCodePlaceholder", () => {
  it("treats the bare dial code as a placeholder", () => {
    expect(isDialCodePlaceholder("+971 ", "+971")).toBe(true);
  });

  it("keeps a row that carries a real number after the dial code", () => {
    expect(isDialCodePlaceholder("+971 501234567", "+971")).toBe(false);
  });

  it("never marks a row as placeholder when the country has no dial code", () => {
    expect(isDialCodePlaceholder("+971", null)).toBe(false);
    expect(isDialCodePlaceholder("+971", "")).toBe(false);
  });
});

describe("pickSuperAdminPhone", () => {
  it("prefers the usable mobile over an earlier phone row", () => {
    expect(
      pickSuperAdminPhone([
        { type: "Phone Number", value: "+971 4 123 4567" },
        { type: "Mobile Number", value: "+971 50 123 4567" }
      ])
    ).toBe("+971 50 123 4567");
  });

  it("skips the dial-code-only prefill row", () => {
    expect(
      pickSuperAdminPhone([
        { type: "Mobile Number", value: "+971" },
        { type: "Mobile Number", value: "+971 50 123 4567" }
      ])
    ).toBe("+971 50 123 4567");
  });

  it("falls back to a usable phone when no mobile is usable", () => {
    expect(pickSuperAdminPhone([{ type: "Phone Number", value: "+971 4 123 4567" }])).toBe("+971 4 123 4567");
  });

  it("returns undefined when there is no phone-like contact", () => {
    expect(pickSuperAdminPhone([{ type: "Email Address", value: "ops@example.com" }])).toBeUndefined();
  });
});

describe("getSuperAdminMissingFields", () => {
  const withMobile = [{ type: "Mobile Number", value: "+971 50 123 4567" }];

  it("returns nothing when every required field and a mobile are present", () => {
    expect(getSuperAdminMissingFields({ ...completeForm, contacts: withMobile })).toEqual([]);
  });

  it("reports the mobile when only the prefill row exists", () => {
    expect(
      getSuperAdminMissingFields({ ...completeForm, contacts: [{ type: "Mobile Number", value: "+971" }] })
    ).toEqual(["mobile"]);
  });

  it("reports each empty field by name", () => {
    expect(
      getSuperAdminMissingFields({
        ...completeForm,
        state: " ",
        owner: "",
        address: "",
        contacts: withMobile
      })
    ).toEqual(["state", "owner", "address"]);
  });

  it("reports city when neither a city nor a district is set", () => {
    expect(
      getSuperAdminMissingFields({ ...completeForm, cityOrDistrict: "", contacts: withMobile })
    ).toEqual(["city"]);
  });
});

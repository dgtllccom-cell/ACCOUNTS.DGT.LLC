import { describe, expect, it } from "vitest";
import {
  DEFAULT_DEVICE_ACCESS,
  DEVICE_KINDS,
  canManageDeviceAccess,
  deviceKindAllowed,
  deviceKindFromUserAgent,
  effectiveDeviceKinds,
  normalizeDeviceKinds,
  sameDeviceAccess,
} from "@/lib/mobile/device-access";

describe("device access allotment (Mobile / Computer)", () => {
  it("normalizes to valid, unique kinds in canonical order", () => {
    expect(normalizeDeviceKinds(["computer", "mobile", "computer", "tablet"])).toEqual(["mobile", "computer"]);
    expect(normalizeDeviceKinds(["bogus"])).toEqual([]);
    expect(normalizeDeviceKinds(null)).toEqual([]);
    expect(normalizeDeviceKinds("mobile")).toEqual([]);
  });

  it("a new login is given every device kind by default", () => {
    expect([...DEFAULT_DEVICE_ACCESS]).toEqual([...DEVICE_KINDS]);
  });

  it("legacy (unrestricted) allows every kind; an allotment allows only what it names", () => {
    expect(deviceKindAllowed(null, "computer")).toBe(true);
    expect(deviceKindAllowed(undefined, "mobile")).toBe(true);
    expect(deviceKindAllowed(["mobile"], "mobile")).toBe(true);
    expect(deviceKindAllowed(["mobile"], "computer")).toBe(false);
    expect(deviceKindAllowed(["computer"], "mobile")).toBe(false);
    expect(deviceKindAllowed([], "mobile")).toBe(false);
  });

  it("a login with several assignments gets the union; one unrestricted assignment makes the login unrestricted", () => {
    expect(effectiveDeviceKinds([{ device_access: ["mobile"] }, { device_access: ["computer"] }])).toEqual(["mobile", "computer"]);
    expect(effectiveDeviceKinds([{ device_access: ["mobile"] }, { device_access: null }])).toBeNull();
    // a database without the column returns no device_access at all: treated as not restricted (legacy)
    expect(effectiveDeviceKinds([{}])).toBeNull();
    expect(effectiveDeviceKinds([])).toEqual([]);
  });

  it("reads the sign-in device kind from the User-Agent (store apps and phone / tablet browsers are mobile)", () => {
    expect(deviceKindFromUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130 Safari/537.36")).toBe("computer");
    expect(deviceKindFromUserAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 Safari/605.1.15")).toBe("computer");
    expect(deviceKindFromUserAgent("Mozilla/5.0 (Linux; Android 16) AppleWebKit/537.36 Chrome/130 Mobile Safari/537.36")).toBe("mobile");
    expect(deviceKindFromUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Mobile/15E148")).toBe("mobile");
    expect(deviceKindFromUserAgent("Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) AppleWebKit/605.1.15")).toBe("mobile");
    // the B / BS store apps are phone apps, whatever the platform token says
    expect(deviceKindFromUserAgent("Mozilla/5.0 (Windows NT 10.0) Chrome/130 DGTllc-B/1")).toBe("mobile");
    expect(deviceKindFromUserAgent("Mozilla/5.0 (iPhone) Mobile/15E148 DGTllc-BS/1")).toBe("mobile");
    // an unidentified client is a computer, so a mobile-only login cannot use it
    expect(deviceKindFromUserAgent(null)).toBe("computer");
    expect(deviceKindFromUserAgent("")).toBe("computer");
  });

  it("only a Super Admin or a Country Admin may set or change device access", () => {
    expect(canManageDeviceAccess({ isSuperAdmin: true, roles: ["super_admin"] })).toBe(true);
    expect(canManageDeviceAccess({ isSuperAdmin: false, roles: ["country_admin"] })).toBe(true);
    expect(canManageDeviceAccess({ isSuperAdmin: false, roles: ["main_branch_admin"] })).toBe(false);
    expect(canManageDeviceAccess({ isSuperAdmin: false, roles: ["city_branch_admin"] })).toBe(false);
    expect(canManageDeviceAccess({ isSuperAdmin: false, roles: ["accountant", "cashier"] })).toBe(false);
    expect(canManageDeviceAccess({ isSuperAdmin: false, roles: ["country_operations_admin"] })).toBe(false);
    expect(canManageDeviceAccess(null)).toBe(false);
  });

  it("compares allotments regardless of order; null counts as every device", () => {
    expect(sameDeviceAccess(["computer", "mobile"], ["mobile", "computer"])).toBe(true);
    expect(sameDeviceAccess(null, ["mobile", "computer"])).toBe(true);
    expect(sameDeviceAccess(undefined, null)).toBe(true);
    expect(sameDeviceAccess(["mobile"], ["mobile", "computer"])).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import { appChannelFromUserAgent, channelAllowsSession, landingForChannel } from "@/lib/mobile/app-channel";

const base = { isSuperAdmin: false, isShippingScoped: false, operationalDomains: ["business"] as ("business" | "shipping" | "both")[], roles: ["country_admin"] as never[] };

describe("app channel (DGT.llc B / BS)", () => {
  it("reads the app from the web view User-Agent tag", () => {
    expect(appChannelFromUserAgent("Mozilla/5.0 (Linux; Android 16) Chrome/130 Mobile DGTllc-B/1")).toBe("b");
    expect(appChannelFromUserAgent("Mozilla/5.0 (iPhone) Mobile/15E148 DGTllc-BS/1")).toBe("bs");
    expect(appChannelFromUserAgent("Mozilla/5.0 Chrome/130")).toBeNull();
    expect(appChannelFromUserAgent(null)).toBeNull();
  });
  it("Business app: business and both logins in, shipping-only out", () => {
    expect(channelAllowsSession("b", base)).toBe(true);
    expect(channelAllowsSession("b", { ...base, operationalDomains: ["both"] })).toBe(true);
    expect(channelAllowsSession("b", { ...base, operationalDomains: ["shipping"], isShippingScoped: true })).toBe(false);
  });
  it("Shipping app: shipping and both logins in, business-only out", () => {
    expect(channelAllowsSession("bs", { ...base, operationalDomains: ["shipping"], isShippingScoped: true })).toBe(true);
    expect(channelAllowsSession("bs", { ...base, operationalDomains: ["both"] })).toBe(true);
    expect(channelAllowsSession("bs", base)).toBe(false);
  });
  it("Super Admin may use either app", () => {
    expect(channelAllowsSession("b", { ...base, isSuperAdmin: true })).toBe(true);
    expect(channelAllowsSession("bs", { ...base, isSuperAdmin: true })).toBe(true);
  });
  it("lands the Shipping app on a shipping-side dashboard, the Business app on the normal one", () => {
    expect(landingForChannel("bs", { ...base, isSuperAdmin: true, roles: ["super_admin"] as never[] })).toBe("/dashboard/shipping-line");
    expect(landingForChannel("bs", { ...base, operationalDomains: ["shipping"], isShippingScoped: true, roles: ["agent_user"] as never[] })).toMatch(/shipping-line|clearing-agent|logistics|agent/);
    expect(landingForChannel("b", { ...base, isSuperAdmin: true, roles: ["super_admin"] as never[] })).toBe("/dashboard/super-admin");
    expect(landingForChannel(null, base)).not.toBe("/dashboard/shipping-line");
  });
});

// @vitest-environment node
import { createHmac } from "node:crypto";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { readMobileProfileFromToken, readTruckTrialFromToken } from "@/lib/auth/edge-session";
const secret = "isolated-test-session-secret";
const tokenFor = (value: object) => {
  const data = Buffer.from(JSON.stringify({ kind: "temp", ...value })).toString("base64url");
  return `${data}.${createHmac("sha256", secret).update(data).digest("base64url")}`;
};
beforeEach(() => vi.stubEnv("ERP_SESSION_SECRET", secret));
afterEach(() => vi.unstubAllEnvs());
it("reads a server-signed trial restriction without granting any role", async () => {
  expect(await readTruckTrialFromToken(tokenFor({ truckTrial: true }))).toBe(true);
  expect(await readTruckTrialFromToken(tokenFor({ truckTrial: false }))).toBe(false);
});
it("does not trust modified or unsigned trial claims", async () => {
  const signed = tokenFor({ truckTrial: false });
  const tampered = Buffer.from(JSON.stringify({ kind: "temp", truckTrial: true })).toString("base64url") + "." + signed.split(".")[1];
  expect(await readTruckTrialFromToken(tampered)).toBe(false);
  expect(await readTruckTrialFromToken("unsigned")).toBe(false);
});
it("keeps existing mobile-profile cookies working", async () => {
  expect(await readMobileProfileFromToken(tokenFor({ assignments: [{ mobileProfile: "mobile_field" }] }))).toBe("mobile_field");
  expect(await readMobileProfileFromToken(tokenFor({ roles: ["super_admin"] }))).toBe("standard");
});

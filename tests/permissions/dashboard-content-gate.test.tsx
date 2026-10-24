import React, { act } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { createRoot, type Root } from "react-dom/client";
import { DashboardContentGate } from "@/components/layout/dashboard-content-gate";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
let root: Root | undefined;
afterEach(() => {
  if (root) act(() => root?.unmount());
  root = undefined;
  document.body.replaceChildren();
});
const shippingStaff = { roles: ["staff_user"], permissions: ["accounts:read", "accounts:create", "route:/dashboard/accounts/setup"], operationalDomains: ["shipping"], canViewFinancials: true };
function view(pathname: string, patch: Partial<typeof shippingStaff> = {}) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => root?.render(<DashboardContentGate {...shippingStaff} {...patch} pathname={pathname} lang="en"><div>Authorized form content</div></DashboardContentGate>));
}
describe("visible dashboard content uses the shared route policy", () => {
  it("renders allotted New Account Setup for shipping staff", () => {
    view("/dashboard/accounts/setup");
    expect(document.body.textContent).toContain("Authorized form content");
    expect(document.body.textContent).not.toContain("Form Access Restricted");
  });
  it("renders allotted user registration for a delegated shipping branch admin", () => {
    view("/dashboard/new-entry/users/registration", { roles: ["city_branch_admin"], permissions: ["users:create"] });
    expect(document.body.textContent).toContain("Authorized form content");
  });
  it("blocks staff user registration without a grant", () => {
    view("/dashboard/new-entry/users/registration");
    expect(document.body.textContent).not.toContain("Authorized form content");
    expect(document.body.textContent).toContain("Form Access Restricted");
  });
  it("blocks an unallotted account form", () => {
    view("/dashboard/accounts/setup", { permissions: ["customers:read"] });
    expect(document.body.textContent).not.toContain("Authorized form content");
  });
  it.each(["/dashboard/purchase/new-purchase-booking-order", "/dashboard/sales/new", "/dashboard/super-admin"])("keeps forbidden %s closed", (pathname) => {
    view(pathname, { permissions: [...shippingStaff.permissions, "purchases:read", "sales:read", `route:${pathname}`] });
    expect(document.body.textContent).not.toContain("Authorized form content");
  });
  it("keeps a strict operations login out of financial forms even with a route token", () => {
    view("/dashboard/accounts/setup", { roles: ["city_operations_admin"], canViewFinancials: false });
    expect(document.body.textContent).not.toContain("Authorized form content");
  });
});

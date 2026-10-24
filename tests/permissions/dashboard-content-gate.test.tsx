import React from "react";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { DashboardContentGate } from "@/components/layout/dashboard-content-gate";

afterEach(cleanup);
const shippingStaff = { roles: ["staff_user"], permissions: ["accounts:read", "accounts:create", "route:/dashboard/accounts/setup"], operationalDomains: ["shipping"], canViewFinancials: true };
function view(pathname: string, patch: Partial<typeof shippingStaff> = {}) {
  render(<DashboardContentGate {...shippingStaff} {...patch} pathname={pathname} lang="en"><div>Authorized form content</div></DashboardContentGate>);
}
describe("visible dashboard content uses the shared route policy", () => {
  it("renders allotted New Account Setup for shipping staff", () => {
    view("/dashboard/accounts/setup");
    expect(screen.getByText("Authorized form content")).toBeTruthy();
    expect(screen.queryByText("Form Access Restricted")).toBeNull();
  });
  it("renders allotted user registration for a delegated shipping branch admin", () => {
    view("/dashboard/new-entry/users/registration", { roles: ["city_branch_admin"], permissions: ["users:create"] });
    expect(screen.getByText("Authorized form content")).toBeTruthy();
  });
  it("blocks staff user registration without a grant", () => {
    view("/dashboard/new-entry/users/registration");
    expect(screen.queryByText("Authorized form content")).toBeNull();
    expect(screen.getByText("Form Access Restricted")).toBeTruthy();
  });
  it("blocks an unallotted account form", () => {
    view("/dashboard/accounts/setup", { permissions: ["customers:read"] });
    expect(screen.queryByText("Authorized form content")).toBeNull();
  });
  it.each(["/dashboard/purchase/new-purchase-booking-order", "/dashboard/sales/new", "/dashboard/super-admin"])("keeps forbidden %s closed", (pathname) => {
    view(pathname, { permissions: [...shippingStaff.permissions, "purchases:read", "sales:read", `route:${pathname}`] });
    expect(screen.queryByText("Authorized form content")).toBeNull();
  });
  it("keeps a strict operations login out of financial forms even with a route token", () => {
    view("/dashboard/accounts/setup", { roles: ["city_operations_admin"], canViewFinancials: false });
    expect(screen.queryByText("Authorized form content")).toBeNull();
  });
});

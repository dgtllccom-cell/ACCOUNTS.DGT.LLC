// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DigitalDockPremiumSidebar, DigitalDockPremiumSidebarWithDrawer } from "@/components/layout/digital-dock-premium-sidebar";

const location = vi.hoisted(() => ({ path: "/dashboard", query: "" }));
vi.mock("next/navigation", () => ({
  usePathname: () => location.path,
  useSearchParams: () => new URLSearchParams(location.query),
}));
vi.mock("next/link", () => ({
  default: ({ onClick, ...props }: React.ComponentProps<"a">) => <a {...props} onClick={event => {
    event.preventDefault();
    onClick?.(event);
  }} />,
}));
vi.mock("@/lib/i18n/use-active-language", () => ({ useActiveLanguage: () => "en" }));
vi.mock("@/lib/branding/client", () => ({ fetchBranding: async () => null, brandingName: () => null }));
vi.mock("@/components/support/safe-support-assistant", () => ({ SafeSupportAssistant: () => null }));

const transfer = "/dashboard/sales/sales-order";
const loading = "/dashboard/sales/sales-loading";
const context = { roles: ["city_branch_admin"], permissions: ["sales:read"], operationalDomains: ["business"] as "business"[], canViewFinancials: true };
const trade = () => screen.getByRole("button", { name: "Purchase, Sales & Trade" });

describe("Live ERP sidebar Sales entry points", () => {
  beforeEach(() => {
    vi.stubGlobal("React", React);
    location.path = "/dashboard";
    location.query = "";
  });
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

  it("offers the distinct opt-in register and the existing Sales Loading from the same main menu", () => {
    const navigate = vi.fn();
    render(<DigitalDockPremiumSidebar {...context} onNavigate={navigate} />);
    fireEvent.click(trade());
    fireEvent.click(screen.getByRole("button", { name: "Sales Booking" }));
    const link = screen.getByRole("link", { name: "Sales Transfer Payment" });
    expect(link.getAttribute("href")).toBe(`${transfer}?transfer=1`);
    const load = screen.getByRole("link", { name: "Sales Loading" });
    const newBooking = screen.getByRole("link", { name: "New Sales Booking Order" });
    expect(newBooking.compareDocumentPosition(link) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(link.compareDocumentPosition(load) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(load.getAttribute("href")).toBe(loading);
    fireEvent.click(load);
    expect(navigate).toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Local Sales" }));
    expect(screen.getByRole("link", { name: "Sales Order & Payment Transfer" }).getAttribute("href")).toBe(transfer);
    expect(screen.getByRole("link", { name: "Local Sales Transfer Payment" }).getAttribute("href")).toBe(`${transfer}?transfer=1&source=local`);
    expect(screen.getByRole("link", { name: "Local Sales Loading" }).getAttribute("href")).toBe(`${loading}?source=local`);
  });

  it("marks only the opted-in menu entry current on its register and reports", () => {
    location.path = transfer;
    location.query = "transfer=1";
    const rendered = render(<DigitalDockPremiumSidebar {...context} />);
    expect(screen.getByRole("link", { name: "Sales Transfer Payment" }).getAttribute("aria-current")).toBe("page");
    fireEvent.click(screen.getByRole("button", { name: "Local Sales" }));
    expect(screen.getByRole("link", { name: "Sales Order & Payment Transfer" }).getAttribute("aria-current")).toBeNull();
    location.path = `${transfer}/view`;
    location.query = "id=one&transfer=1";
    rendered.rerender(<DigitalDockPremiumSidebar {...context} />);
    expect(screen.getByRole("link", { name: "Sales Transfer Payment" }).getAttribute("aria-current")).toBe("page");
    location.query = "id=one";
    rendered.rerender(<DigitalDockPremiumSidebar {...context} />);
    expect(screen.queryByRole("link", { name: "Sales Transfer Payment" })?.getAttribute("aria-current") ?? null).toBeNull();
    expect(screen.getByRole("link", { name: "Sales Order & Payment Transfer" }).getAttribute("aria-current")).toBe("page");
  });

  it("selects the Local Sales menu for scoped Transfer and Loading URLs", () => {
    location.path = transfer;
    location.query = "transfer=1&source=local";
    const rendered = render(<DigitalDockPremiumSidebar {...context} />);
    expect(screen.getByRole("link", { name: "Local Sales Transfer Payment" }).getAttribute("aria-current")).toBe("page");
    location.path = loading;
    location.query = "source=local";
    rendered.rerender(<DigitalDockPremiumSidebar {...context} />);
    expect(screen.getByRole("link", { name: "Local Sales Loading" }).getAttribute("aria-current")).toBe("page");
  });

  it("offers Loading, but not Transfer Payment, in the drawer for a non-financial business role", () => {
    render(<DigitalDockPremiumSidebarWithDrawer {...context} canViewFinancials={false} open onOpenChange={vi.fn()} />);
    fireEvent.click(trade());
    fireEvent.click(screen.getByRole("button", { name: "Sales Booking" }));
    expect(screen.queryByRole("link", { name: "Sales Transfer Payment" })).toBeNull();
    expect(screen.getByRole("link", { name: "Sales Loading" }).getAttribute("href")).toBe(loading);
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

const openPrint = vi.fn();
vi.mock("@/lib/store/print-store", () => ({ printStore: { openPrint: (...args: unknown[]) => openPrint(...args) } }));

import { openA4ReportWindow, type BranchReportData } from "@/lib/reports/open-a4-report-window";

const branch: BranchReportData = {
  serialNumber: "ABCD",
  branchStatus: "Draft",
  branchCode: "SUPER-HQ-001",
  branchType: "SUPER_ADMIN",
  country: "United Arab Emirates",
  currency: "USD",
  branchName: "Damaan Global Trading LLC Super Admin Branch",
  city: "Dubai",
  stateProvince: "Dubai",
  zipCode: "00000",
  fullAddress: "Al Maktoum Street, Deira",
  ownerName: "Ali Khan",
  ownerCode: "CUST-1A2B3C4D",
  companyName: "Damaan Global Trading LLC",
  companyCode: "CMP-AAAA1111",
  contactRows: [
    { type: "Mobile Number", value: "+971 50 123 4567" },
    { type: "Email Address", value: "ops@example.com" }
  ]
};

function printedHtml(): string {
  expect(openPrint).toHaveBeenCalledTimes(1);
  return String(openPrint.mock.calls[0][0]);
}

describe("Super Admin Branch compact A4 print", () => {
  beforeEach(() => {
    openPrint.mockClear();
  });

  it("renders one compact page with the required fields", () => {
    openA4ReportWindow({ title: "Super Admin Branch Report", subtitle: "Store Entry Preview (A4)", branchData: branch, compact: true, lang: "en" });
    const html = printedHtml();

    expect(html).toContain('class="page sa-compact"');
    expect(html).toContain("@page { size: A4;");
    for (const value of [
      "Damaan Global Trading LLC",
      "CMP-AAAA1111",
      "Damaan Global Trading LLC Super Admin Branch",
      "SUPER-HQ-001",
      "United Arab Emirates",
      "Dubai",
      "Al Maktoum Street, Deira",
      "USD",
      "Ali Khan",
      "CUST-1A2B3C4D",
      "+971 50 123 4567",
      "ops@example.com"
    ]) {
      expect(html).toContain(value);
    }
  });

  it("leaves out the long placeholder report sections", () => {
    openA4ReportWindow({ title: "T", branchData: branch, compact: true, lang: "en" });
    const html = printedHtml();

    expect(html).not.toContain("Branch Permissions &amp; Access Rights");
    expect(html).not.toContain("Father/Husband Name");
    expect(html).not.toContain("Pakistani");
    expect(html).not.toContain("Parent Scope");
  });

  it("does not print a fabricated owner code when none is linked", () => {
    openA4ReportWindow({ title: "T", branchData: { ...branch, ownerCode: "" }, compact: true, lang: "en" });
    const html = printedHtml();

    expect(html).not.toContain("OWN-0001");
    expect(html).toContain('<div class="sa-value"><bdi dir="ltr">-</bdi></div>');
  });

  it("prints the empty-contacts line when no contact rows exist", () => {
    openA4ReportWindow({ title: "T", branchData: { ...branch, contactRows: [] }, compact: true, lang: "en" });
    expect(printedHtml()).toContain("No contacts added yet.");
  });

  it("escapes user-entered text", () => {
    openA4ReportWindow({
      title: "T",
      branchData: { ...branch, companyName: "<img src=x onerror=alert(1)>" },
      compact: true,
      lang: "en"
    });
    const html = printedHtml();

    expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;");
    expect(html).not.toContain("<img src=x");
  });

  it("switches to RTL and localized labels for ur", () => {
    openA4ReportWindow({ title: "T", branchData: branch, compact: true, lang: "ur" });
    const html = printedHtml();

    expect(html).toContain('dir="rtl"');
    expect(html).not.toContain("Company Information");
    expect(html).not.toContain("Location Information");
  });

  it("keeps the full branch report when compact is not set", () => {
    openA4ReportWindow({ title: "T", branchData: branch, lang: "en" });
    const html = printedHtml();

    expect(html).toContain('class="page"');
    expect(html).toContain("Branch Permissions");
    expect(html).not.toContain('class="page sa-compact"');
  });
});

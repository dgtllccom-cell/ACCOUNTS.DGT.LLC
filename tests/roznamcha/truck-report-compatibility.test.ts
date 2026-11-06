import { describe, expect, it } from "vitest";
import { buildTruckProfileConfig } from "@/lib/reports/master-profiles/build-truck-profile";
import { buildMasterProfileReportHtml } from "@/lib/reports/open-master-profile-report-window";
import type { DocumentBranding } from "@/lib/reports/resolve-document-branding";
const branding: DocumentBranding = {
  entityName: "Transport Office", legalName: null, logoUrl: null, stampUrl: null, address: null, phone: null, email: null,
  website: null, registrationNumber: null, taxNumber: null, countryName: null, branchName: null, baseCurrency: null, bank: null, raw: null,
};
describe("existing Truck Registration print/PDF source", () => {
  it.each(["en", "ur", "ar", "fa", "ps"] as const)("keeps the real owner, driver, truck and company in compact A4 %s", (lang) => {
    const config = buildTruckProfileConfig({ truckNumber: "TEST-TRK-001", branchName: "Assigned Branch",
      owner: { fullName: "مالک اصل نام" }, driver: { fullName: "Driver Original Name" }, company: { name: "Transport Company" }, remarks: "Original remarks" }, branding, lang);
    const html = buildMasterProfileReportHtml(config);
    for (const value of ["TEST-TRK-001", "مالک اصل نام", "Driver Original Name", "Transport Company", "Original remarks"]) expect(html).toContain(value);
    expect(html).toContain("size: A4 portrait");
    expect(html).toContain(`lang="${lang}" dir="${lang === "en" ? "ltr" : "rtl"}"`);
  });
});

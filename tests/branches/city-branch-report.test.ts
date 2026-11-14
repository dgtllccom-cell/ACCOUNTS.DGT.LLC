import { describe, expect, it } from "vitest";
import {
  documentTypeLabel,
  formatFileSize,
  locationMetaFromSaved,
  normalizeCityBranchDetail,
  type CityBranchLocationNames
} from "@/features/branches/lib/city-branch-detail";
import { normalizeCompanyRecord, normalizeOwnerRecord } from "@/features/branches/lib/city-branch-owner-company";
import {
  buildCityBranchDrawerData,
  buildCityBranchReportConfig,
  buildCityBranchReportSections,
  type CityBranchReportInput
} from "@/features/branches/lib/city-branch-report";
import { buildMasterProfileReportHtml } from "@/lib/reports/open-master-profile-report-window";

const tt = (_key: string, fallback: string) => fallback;

const LOCATION: CityBranchLocationNames = {
  countryName: "United Arab Emirates",
  countryIso2: "AE",
  countryIso3: "ARE",
  countryCurrency: "AED",
  countryPhoneCode: "+971",
  stateName: "Dubai",
  districtName: "Central",
  cityName: "Dubai",
  cityCode: "DXB",
  cityZip: "00000",
  areaName: "Al Ras",
  areaPostal: "12345"
};

const COMPANY = normalizeCompanyRecord({
  id: "11111111-1111-4111-8111-111111111111",
  company_code: "CMP-0007",
  name: "Al Ras Trading",
  legal_name: "Al Ras Trading LLC",
  base_currency: "AED",
  registration_number: "REG-99",
  tax_number: "TAX-1",
  owner_name: "Hamid Khan",
  country_name: "United Arab Emirates",
  city_name: "Dubai",
  address: "Office 12, Al Ras",
  contacts: []
});

const OWNER = normalizeOwnerRecord({
  id: "22222222-2222-4222-8222-222222222222",
  person_code: "PER-0042",
  customer_name: "Hamid Khan",
  company_name: "Al Ras Trading LLC",
  mobile: "+971500000002",
  email: "hamid@example.com",
  address: "Villa 4, Jumeirah",
  country_name: "United Arab Emirates",
  city_name: "Dubai"
});

function reportInput(overrides: Partial<CityBranchReportInput> = {}): CityBranchReportInput {
  return {
    savedId: "33333333-3333-4333-8333-333333333333",
    name: "Dubai City Branch",
    code: "ARE-DXB-001",
    status: "active",
    currency: "AED",
    operationalDomain: "business",
    createdAt: "2026-11-01T08:00:00.000Z",
    updatedAt: "2026-11-02T09:30:00.000Z",
    createdByName: "Super Admin",
    country: "United Arab Emirates",
    countryIso2: "AE",
    state: "Dubai",
    district: "Central",
    city: "Dubai",
    area: "Al Ras",
    zip: "12345",
    fullAddress: "Shop 9, Al Ras",
    mainBranchName: "UAE Main Branch",
    mainBranchCode: "ARE-MAIN",
    mainBranchCurrency: "AED",
    contacts: [
      { type: "Mobile", value: "+971500000010" },
      { type: "Email", value: "dxb-001@dgt.llc" }
    ],
    permissionTemplate: "city-standard",
    permissionGrants: ["city.view", "city.edit"],
    company: COMPANY,
    owner: OWNER,
    users: [
      {
        assignmentId: "a1",
        userId: "u1",
        userName: "Asad Ali",
        userCode: "USR-0001",
        role: "city_branch_admin",
        operationalDomain: "business",
        accessProfile: "operations",
        isActive: true
      }
    ],
    documents: [
      { id: "d1", name: "Trade Licence.pdf", mimeType: "application/pdf", sizeBytes: 245760, createdAt: "2026-11-03T10:00:00.000Z" }
    ],
    ...overrides
  };
}

describe("city-branch-detail", () => {
  it("normalizes a complete saved detail", () => {
    const detail = normalizeCityBranchDetail({
      location: { ...LOCATION },
      linkedUsers: [{ assignmentId: "a1", userId: "u1", userName: "Asad Ali", userCode: "USR-0001", role: "branch_admin", operationalDomain: "shipping", accessProfile: "", isActive: true }],
      linkedDocuments: [{ id: "d1", name: "Licence.pdf", mimeType: "application/pdf", sizeBytes: 1024, createdAt: "2026-11-03T10:00:00.000Z" }],
      createdByName: "Super Admin"
    });
    expect(detail?.location.stateName).toBe("Dubai");
    expect(detail?.location.countryCurrency).toBe("AED");
    expect(detail?.linkedUsers[0]).toMatchObject({ userName: "Asad Ali", role: "branch_admin", operationalDomain: "shipping" });
    expect(detail?.linkedDocuments[0].sizeBytes).toBe(1024);
    expect(detail?.createdByName).toBe("Super Admin");
  });

  it("empty detail: no users, no documents, no location names", () => {
    const detail = normalizeCityBranchDetail({ location: {}, linkedUsers: [], linkedDocuments: [], createdByName: "" });
    expect(detail?.linkedUsers).toEqual([]);
    expect(detail?.linkedDocuments).toEqual([]);
    expect(detail?.location.stateName).toBe("");
    expect(normalizeCityBranchDetail(null)).toBeNull();
  });

  it("rebuilds the location meta used by the picker and the report from saved names", () => {
    const ids = { countryId: "c1", stateProvinceId: "s1", districtId: "", cityId: "ct1", areaId: "a1" };
    const meta = locationMetaFromSaved(ids, LOCATION);
    expect(meta.country?.name).toBe("United Arab Emirates");
    expect(meta.state?.name).toBe("Dubai");
    expect(meta.city?.zip_code).toBe("00000");
    expect(meta.area?.postal_code).toBe("12345");
    expect(meta.district?.name).toBe("Central");
    const empty = locationMetaFromSaved(ids, { ...LOCATION, stateName: "", areaName: "", cityName: "" });
    expect(empty.state).toBeNull();
    expect(empty.area).toBeNull();
    expect(empty.city).toBeNull();
  });

  it("document label and size formatting", () => {
    expect(documentTypeLabel("application/pdf", "a.pdf")).toBe("PDF");
    expect(documentTypeLabel("", "scan.HEIC")).toBe("HEIC");
    expect(formatFileSize(245760)).toBe("240 KB");
    expect(formatFileSize(null)).toBe("");
  });
});

describe("city-branch-report", () => {
  it("shows the saved company and owner values, not dashes, in the sections", () => {
    const { sections } = buildCityBranchReportSections(reportInput(), tt);
    const company = sections.find((s) => s.title === "Company Details");
    const owner = sections.find((s) => s.title === "Owner Details");
    expect(company?.rows).toEqual(expect.arrayContaining([expect.objectContaining({ label: "Company Code", value: "CMP-0007" })]));
    expect(company?.rows).toEqual(expect.arrayContaining([expect.objectContaining({ label: "Legal Name", value: "Al Ras Trading LLC" })]));
    expect(owner?.rows).toEqual(expect.arrayContaining([expect.objectContaining({ label: "Owner Code", value: "PER-0042" })]));
    expect(owner?.rows).toEqual(expect.arrayContaining([expect.objectContaining({ label: "Mobile", value: "+971500000002" })]));
  });

  it("empty company and owner: their sections are empty rather than sample text", () => {
    const { sections } = buildCityBranchReportSections(reportInput({ company: null, owner: null }), tt);
    expect(sections.find((s) => s.title === "Company Details")?.rows).toEqual([]);
    expect(sections.find((s) => s.title === "Owner Details")?.rows).toEqual([]);
  });

  it("lists linked users and documents as tables only when they exist", () => {
    const full = buildCityBranchReportSections(reportInput(), tt);
    expect(full.relatedTables.map((t) => t.title)).toEqual(["Assigned Users", "Linked Documents"]);
    expect(full.relatedTables[0].rows[0]).toEqual(expect.arrayContaining(["Asad Ali", "USR-0001", "City Branch Admin"]));
    const none = buildCityBranchReportSections(reportInput({ users: [], documents: [] }), tt);
    expect(none.relatedTables).toEqual([]);
  });

  it("print HTML carries the saved values and the Urdu RTL direction", () => {
    const config = buildCityBranchReportConfig(reportInput(), { lang: "ur", autoPrint: false, tt });
    const html = buildMasterProfileReportHtml(config);
    expect(html).toContain("ARE-DXB-001");
    expect(html).toContain("Al Ras Trading LLC");
    expect(html).toContain("PER-0042");
    expect(html).toContain("Asad Ali");
    expect(html).toContain("Trade Licence.pdf");
    expect(html).toMatch(/dir="rtl"/);
  });

  it("drawer data uses only real values (no sample owner, country or headquarters text)", () => {
    const data = buildCityBranchDrawerData(reportInput({ owner: null, company: null, users: [], documents: [] }), tt);
    const serialized = JSON.stringify(data);
    expect(serialized).not.toMatch(/Pakistani|OWN-0001|SUPER-HQ-001|Headquarters|Individual|Branch Manager/);
    expect(data.branchCode).toBe("ARE-DXB-001");
    expect(data.ownerName).toBeUndefined();
  });
});

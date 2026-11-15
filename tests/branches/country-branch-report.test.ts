import { describe, expect, it } from "vitest";
import {
  buildCountryBranchDrawerData,
  buildCountryBranchProfileData,
  buildCountryBranchRows,
  countryBranchContact,
  type CountryBranchReportInput
} from "@/features/branches/lib/country-branch-report";
import type { CompanyView, OwnerView } from "@/features/branches/lib/city-branch-owner-company";

const tt = (_key: string, fallback: string) => fallback;

const COMPANY: CompanyView = {
  id: "633fa062-d3e9-492a-bdd3-8561d7a77599",
  name: "ASMATULLAH RETAIL SHOP",
  legalName: "ASMATULLAH RETAIL SHOP",
  tradeName: "",
  companyCode: "COMP-000156",
  baseCurrency: "PKR",
  businessType: "",
  companyType: "",
  companyStatus: "Active",
  registrationNumber: "REG-778",
  taxNumber: "1234567-8",
  ownerPersonId: "c1b1cd6c-5d97-4f9a-a7e0-df0e0a566e2b",
  ownerName: "",
  country: "Pakistan",
  state: "Balochistan",
  city: "Quetta",
  area: "",
  zipCode: "",
  address: "HAZAR, GANJI, QUETTA",
  contacts: [
    { type: "email", value: "ops@asmat.example" },
    { type: "cell", value: "+92 300 1112233" }
  ]
};

const OWNER: OwnerView = {
  source: "customer",
  id: "c1b1cd6c-5d97-4f9a-a7e0-df0e0a566e2b",
  code: "PER-000208",
  name: "Asmatullah Abdullah",
  companyName: "",
  contactPerson: "",
  mobile: "+92 300 4445566",
  whatsapp: "",
  email: "",
  address: "",
  country: "",
  state: "",
  district: "",
  city: ""
};

const BASE: CountryBranchReportInput = {
  savedId: "5269c1cb-92a1-4aa8-aad8-d4c7260badaa",
  name: "Pakistan Main Branch",
  code: "PAK-MAIN-001",
  status: "active",
  currency: "PKR",
  operationalDomain: "business",
  createdAt: "2026-07-14T12:23:56.655Z",
  updatedAt: "2026-09-29T19:15:29.658Z",
  createdByName: "Super Admin",
  country: "Pakistan",
  countryIso2: "PK",
  stateProvince: "Balochistan",
  district: "",
  city: "Quetta",
  fullAddress: "Hazar Ganji, Quetta",
  contacts: [{ type: "Mobile", value: "+92 300 9998877" }],
  branchEmail: "pak.main@example.com",
  ownerName: "Asmatullah Abdullah",
  company: COMPANY,
  owner: OWNER,
  permissionTemplate: "country-standard",
  permissionGrants: ["dashboard.access"]
};

const SAMPLE_TEXT = [
  "Headquarters",
  "SUPER-HQ-001",
  "OWN-0001",
  "Pakistani",
  "Individual",
  "100%",
  "Country Admin",
  "Head Office (DXB-001)",
  "Saved country main branch details registry."
];

describe("Country Main Branch report data", () => {
  it("drawer company fields come from the saved company record (name, NTN, tax, email, contact)", () => {
    const d = buildCountryBranchDrawerData(BASE, tt);
    expect(d.companyName).toBe("ASMATULLAH RETAIL SHOP");
    expect(d.companyCode).toBe("COMP-000156");
    expect(d.companyRegNo).toBe("REG-778");
    expect(d.companyTaxRegNo).toBe("1234567-8");
    expect(d.companyEmail).toBe("ops@asmat.example");
    expect(d.companyPhone).toBe("+92 300 1112233");
    expect(d.companyOfficeAddress).toBe("HAZAR, GANJI, QUETTA");
  });

  it("drawer owner fields come from the loaded owner record, not the stale owner name", () => {
    const d = buildCountryBranchDrawerData({ ...BASE, ownerName: "najee ullah" }, tt);
    expect(d.ownerName).toBe("Asmatullah Abdullah");
    expect(d.ownerCode).toBe("PER-000208");
    expect(d.ownerPhone).toBe("+92 300 4445566");
  });

  it("missing company tax number stays undefined (shown as a dash), it is never invented", () => {
    const d = buildCountryBranchDrawerData({ ...BASE, company: { ...COMPANY, taxNumber: "" } }, tt);
    expect(d.companyTaxRegNo).toBeUndefined();
  });

  it("the full address and location are the saved values; no sample text appears in any report model", () => {
    const d = buildCountryBranchDrawerData(BASE, tt);
    expect(d.fullAddress).toBe("Hazar Ganji, Quetta");
    expect(d.stateProvince).toBe("Balochistan");
    expect(d.city).toBe("Quetta");
    const profile = buildCountryBranchProfileData(BASE, tt);
    const everything = JSON.stringify({ d, profile, rows: buildCountryBranchRows(BASE, tt) });
    for (const sample of SAMPLE_TEXT) {
      expect(everything.includes(sample)).toBe(false);
    }
  });

  it("with no company and no owner loaded, the company and owner fields are empty, not sample values", () => {
    const d = buildCountryBranchDrawerData({ ...BASE, company: null, owner: null, ownerName: "" }, tt);
    expect(d.companyName).toBeUndefined();
    expect(d.ownerName).toBeUndefined();
    expect(d.ownerCode).toBeUndefined();
    expect(d.nationality).toBeUndefined();
  });

  it("the profile print model carries the same company tax and owner values", () => {
    const p = buildCountryBranchProfileData(BASE, tt);
    expect(p.companyName).toBe("ASMATULLAH RETAIL SHOP");
    expect(p.taxRegNo).toBe("1234567-8");
    expect(p.ownerCode).toBe("PER-000208");
    expect(p.branchType).toBe("Country Main Branch");
    expect(p.countryCode).toBe("PK");
  });

  it("the CSV rows include the branch email and the company rows from the same record", () => {
    const rows = buildCountryBranchRows(BASE, tt);
    const value = (label: string) => rows.find((r) => r.label === label)?.value;
    expect(value("Email")).toBe("pak.main@example.com");
    expect(value("Tax / NTN No.")).toBe("1234567-8");
    expect(value("Company Name")).toBe("ASMATULLAH RETAIL SHOP");
  });

  it("contact lookup returns the first non-empty value of a kind", () => {
    expect(countryBranchContact([{ type: "Mobile", value: "" }, { type: "Mobile", value: "123" }], (t) => t.includes("mobile"))).toBe("123");
    expect(countryBranchContact([], (t) => t.includes("mobile"))).toBe("");
  });
});

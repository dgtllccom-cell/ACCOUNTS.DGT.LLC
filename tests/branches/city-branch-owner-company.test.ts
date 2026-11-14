import { describe, expect, it } from "vitest";
import {
  loadCompanyOwnerViews,
  normalizeCompanyRecord,
  normalizeOwnerRecord,
  emptyOwnerView
} from "@/features/branches/lib/city-branch-owner-company";

const COMPANY_ROW = {
  id: "11111111-1111-4111-8111-111111111111",
  company_code: "CMP-0007",
  name: "Al Ras Trading",
  legal_name: "Al Ras Trading LLC",
  trade_name: "Al Ras",
  base_currency: "aed",
  business_type: "Trading",
  company_type: "customer",
  company_status: "Active",
  registration_number: "REG-99",
  tax_number: "TAX-1",
  owner_person_id: "22222222-2222-4222-8222-222222222222",
  owner_name: "Hamid Khan",
  country_name: "United Arab Emirates",
  state_name: "Dubai",
  city_name: "Dubai",
  area_name: "Al Ras",
  zip_code: "00000",
  address: "Office 12, Al Ras",
  contacts: [{ type: "Phone", value: "+971500000001" }, { type: "", value: "" }, { label: "Email", value: "ras@example.com" }]
};

const OWNER_ROW = {
  id: "22222222-2222-4222-8222-222222222222",
  person_code: "PER-0042",
  customer_name: "Hamid Khan",
  company_name: "Al Ras Trading LLC",
  contact_person: "Hamid",
  mobile: "+971500000002",
  whatsapp: "+971500000003",
  email: "hamid@example.com",
  address: "Villa 4, Jumeirah",
  country_name: "United Arab Emirates",
  state_province_name: "Dubai",
  district_name: "Central",
  city_name: "Dubai"
};

describe("normalizeCompanyRecord", () => {
  it("maps a complete saved company to the view, using the saved company code (no UUID-derived code)", () => {
    const view = normalizeCompanyRecord(COMPANY_ROW);
    expect(view).not.toBeNull();
    expect(view).toMatchObject({
      id: COMPANY_ROW.id,
      name: "Al Ras Trading",
      legalName: "Al Ras Trading LLC",
      companyCode: "CMP-0007",
      baseCurrency: "AED",
      registrationNumber: "REG-99",
      taxNumber: "TAX-1",
      ownerPersonId: OWNER_ROW.id,
      ownerName: "Hamid Khan",
      country: "United Arab Emirates",
      city: "Dubai",
      area: "Al Ras",
      zipCode: "00000",
      address: "Office 12, Al Ras"
    });
  });

  it("keeps only contacts that have both a type and a value, and reads label-style contacts", () => {
    const view = normalizeCompanyRecord(COMPANY_ROW);
    expect(view?.contacts).toEqual([
      { type: "Phone", value: "+971500000001" },
      { type: "Email", value: "ras@example.com" }
    ]);
  });

  it("parses contacts stored as a JSON string", () => {
    const view = normalizeCompanyRecord({ ...COMPANY_ROW, contacts: JSON.stringify([{ type: "Fax", value: "123" }]) });
    expect(view?.contacts).toEqual([{ type: "Fax", value: "123" }]);
  });

  it("returns empty strings (not a fabricated code) for an incomplete company", () => {
    const view = normalizeCompanyRecord({ id: COMPANY_ROW.id, name: "Bare Co", company_code: null, base_currency: null, contacts: null });
    expect(view).toMatchObject({ name: "Bare Co", companyCode: "", baseCurrency: "", address: "", country: "", contacts: [] });
  });

  it("returns null for an empty or id-less record", () => {
    expect(normalizeCompanyRecord(null)).toBeNull();
    expect(normalizeCompanyRecord(undefined)).toBeNull();
    expect(normalizeCompanyRecord({ name: "No id" })).toBeNull();
  });
});

describe("normalizeOwnerRecord", () => {
  it("maps a complete customer record, using the saved person code", () => {
    expect(normalizeOwnerRecord(OWNER_ROW)).toEqual({
      source: "customer",
      id: OWNER_ROW.id,
      code: "PER-0042",
      name: "Hamid Khan",
      companyName: "Al Ras Trading LLC",
      contactPerson: "Hamid",
      mobile: "+971500000002",
      whatsapp: "+971500000003",
      email: "hamid@example.com",
      address: "Villa 4, Jumeirah",
      country: "United Arab Emirates",
      state: "Dubai",
      district: "Central",
      city: "Dubai"
    });
  });

  it("leaves unsaved owner fields empty instead of guessing them", () => {
    const view = normalizeOwnerRecord({ id: OWNER_ROW.id, customer_name: "Only Name" });
    expect(view).toMatchObject({ name: "Only Name", code: "", mobile: "", email: "", address: "" });
  });

  it("returns null when the owner has no id", () => {
    expect(normalizeOwnerRecord({ customer_name: "Nobody" })).toBeNull();
  });

  it("builds a name-only owner view for a non-customer owner", () => {
    expect(emptyOwnerView("Profile Owner", "profile")).toMatchObject({ source: "profile", name: "Profile Owner", code: "", id: "" });
  });
});

describe("loadCompanyOwnerViews (single loader, injected getter)", () => {
  it("loads company, owner and bank count together from the existing API paths", async () => {
    const urls: string[] = [];
    const get = async <T,>(url: string): Promise<T> => {
      urls.push(url);
      if (url.startsWith("/api/erp/companies/") && url.endsWith("/bank-accounts")) return { banks: [{ id: "b1" }, { id: "b2" }] } as T;
      if (url.startsWith("/api/erp/companies/")) return { company: COMPANY_ROW } as T;
      if (url.startsWith("/api/erp/customers/")) return { customer: OWNER_ROW } as T;
      throw new Error(`unexpected ${url}`);
    };
    const result = await loadCompanyOwnerViews({ companyId: COMPANY_ROW.id, ownerCustomerId: OWNER_ROW.id }, get);
    expect(result.company?.companyCode).toBe("CMP-0007");
    expect(result.owner?.code).toBe("PER-0042");
    expect(result.companyBankCount).toBe(2);
    expect(urls).toEqual(
      expect.arrayContaining([
        `/api/erp/companies/${COMPANY_ROW.id}`,
        `/api/erp/companies/${COMPANY_ROW.id}/bank-accounts`,
        `/api/erp/customers/${OWNER_ROW.id}`
      ])
    );
  });

  it("returns no owner and zero bank accounts when nothing is selected (empty)", async () => {
    const get = async <T,>(url: string): Promise<T> => {
      if (url.endsWith("/bank-accounts")) return { banks: [] } as T;
      return { company: null } as T;
    };
    const result = await loadCompanyOwnerViews({ companyId: "", ownerCustomerId: null }, get);
    expect(result).toEqual({ company: null, owner: null, companyBankCount: 0 });
  });
});

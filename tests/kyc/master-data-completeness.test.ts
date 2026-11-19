import { describe, expect, it } from "vitest";
import { getCompanyMissingRequirements, getCustomerMissingRequirements } from "@/lib/kyc/master-data-completeness";

describe("company and customer KYC completion", () => {
  it("keeps an incomplete company in the queue", () => {
    expect(getCompanyMissingRequirements({ name: "DGT", country_id: null, base_currency: "", address: "", contacts: [] }))
      .toEqual([
        "Missing Company Country",
        "Missing Company Base Currency",
        "Missing Company Address",
        "Missing Company Contact Details"
      ]);
  });

  it("accepts a company only when its core KYC profile is complete", () => {
    expect(getCompanyMissingRequirements({
      legal_name: "DGT LLC",
      country_id: "country-1",
      base_currency: "AED",
      address: "Dubai",
      contacts: [{ type: "phone", value: "+971500000000" }]
    })).toEqual([]);
  });

  it("keeps an incomplete customer in the queue", () => {
    expect(getCustomerMissingRequirements({ customer_name: "", country_id: null, mobile: "", whatsapp: "", address: "" }))
      .toEqual([
        "Missing Customer Name",
        "Missing Customer Country",
        "Missing Customer Mobile / WhatsApp",
        "Missing Customer Address"
      ]);
  });

  it("accepts a customer with name, country, contact and address", () => {
    expect(getCustomerMissingRequirements({
      customer_name: "Ahmad Trading",
      country_id: "country-1",
      whatsapp: "+971500000000",
      address: "Dubai"
    })).toEqual([]);
  });
});


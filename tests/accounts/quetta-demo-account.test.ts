import { expect, it } from "vitest";
import { isQuettaDemoReference, validQuettaDemoFields } from "@/lib/quetta-demo-account";

const safe = { manualReferenceNumber: "QTEST0501", scope:"city_branch", code:"AUTO", currency:"PKR",
  countryId:"pk", countryBranchId:"parent", cityBranchId:"quetta", addressCountryId:"physical",
  addressStateId:"state", addressCityId:"city", fullAddress:"Demo address", contacts:[{type:"Email"}],
  customerId:"customer", companyId:"company", bankId:"bank", openingBalance:0, category:"P/S" };
it("reserves exactly the approved test reference sequence",()=>{
 expect(["QTEST0500","QTEST0501","QTEST1000","QTEST1001","ALRAS0501"].map(isQuettaDemoReference))
   .toEqual([false,true,true,false,false]);
});
it("requires complete nonfinancial account details and exactly one ID per master",()=>{
 expect(validQuettaDemoFields({...safe, linkedBanks:[{id:"bank"}]})).toBe(true);
 expect(validQuettaDemoFields({...safe, linkedBanks:[{id:"different-bank"}]})).toBe(false);
 expect(validQuettaDemoFields({...safe, currency:"AED"})).toBe(false);
 expect(validQuettaDemoFields({...safe, openingBalance:1})).toBe(false);
 expect(validQuettaDemoFields({...safe, addressCityId:null})).toBe(false);
 expect(validQuettaDemoFields({...safe, contacts:[]})).toBe(false);
});

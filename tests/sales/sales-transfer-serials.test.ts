import { describe, expect, it } from "vitest";
import { bookingScopeSerials, groupExactSerials, scopeSerials } from "@/lib/sales/sales-transfer-serials";

describe("Sales Transfer serials", () => {
  it("preserves all four independently allocated levels", () => {
    expect(scopeSerials({
      super_admin_serial_number: "GLB-0057",
      country_transaction_serial_number: "AE-0044",
      main_branch_transaction_serial: "DXB-0003",
      city_branch_transaction_serial: "DXB-CS-0002",
    })).toEqual({ superAdmin: "GLB-0057", country: "AE-0044", mainBranch: "DXB-0003", cityBranch: "DXB-CS-0002" });
  });

  it("uses no invented number for a missing main or city serial", () => {
    expect(scopeSerials({ super_admin_serial_number: "GLB-0062", country_transaction_serial_number: "" }))
      .toEqual({ superAdmin: "GLB-0062", country: null, mainBranch: null, cityBranch: null });
  });

  it("does not map a historical city number to the main branch as well", () => {
    const legacy = { country_branch_id: "main-id", branch_transaction_serial_number: "B-0007" };
    expect(bookingScopeSerials({ ...legacy, city_branch_id:"city-id" })).toMatchObject({ mainBranch:null, cityBranch:"B-0007" });
    expect(bookingScopeSerials(legacy)).toMatchObject({ mainBranch:"B-0007", cityBranch:null });
  });

  it("shows an exact shared number once without merging distinct DR and CR", () => {
    expect(groupExactSerials([["VR", "VR-0003"], ["DR", "ABC-0042"], ["CR", " ABC-0042 "]] as const)).toEqual([
      { serial: "VR-0003", kinds: ["VR"] }, { serial: "ABC-0042", kinds: ["DR", "CR"] },
    ]);
    expect(groupExactSerials([["DR", "DR-0001"], ["CR", "CR-0001"]] as const)).toHaveLength(2);
  });
});

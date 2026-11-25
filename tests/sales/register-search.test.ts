import { describe, expect, it } from "vitest";
import { bookingSearchFields, bookingSearchRow } from "@/lib/sales/booking-register-search";
import { matchesRegisterSearch, registerSearchOptions } from "@/lib/sales/register-search";

const rows = [
  bookingSearchRow({ sales_order_no: "SB-0042", salesDate: "2026-11-23", countryName: "UAE", branchName: "Dubai", form_data: { form: { mainBranchName: "Main UAE", loadingCountry: "China", loadingPort: "Ningbo", receivingCountry: "UAE", receivingPort: "Jebel Ali", receivedDate: "2026-11-25" }, goodsEntries: [{ goodsName: "Cashmere", lotName: "Winter Lot", lotNo: "L-101" }, { goodsName: "Walnuts", lotNo: "L-102" }] } }, true),
  bookingSearchRow({ salesBookingOrderNumber: "SB-0043", salesDate: "2026-11-21", countryName: "Pakistan", branchName: "Karachi", form_data: { form: { mainBranchName: "Main PK", loadingCountry: "Iran", loadingPort: "Bandar Abbas" } } }, false),
];

describe("scoped advanced Sales register search", () => {
  it("combines booking, goods, lot, transfer, destination and inclusive dates", () => {
    const filters = { bookingNo: "sb-004", goods: "Walnuts", lot: "L-102", transferStatus: "transferred", receivedCountry: "UAE", receivedDateFrom: "2026-11-25", receivedDateTo: "2026-11-25" };
    expect(rows.filter(row => matchesRegisterSearch(row, filters))).toEqual([rows[0]]);
    expect(matchesRegisterSearch(rows[0], { receivedDateTo: "2026-11-24" })).toBe(false);
    expect(matchesRegisterSearch(rows[1], { receivedDateFrom: "2026-11-24" })).toBe(false);
    expect(matchesRegisterSearch(rows[0], {})).toBe(true);
  });
  it("lists only observed data and cascades countries, branches and ports", () => {
    const fields = bookingSearchFields(rows, String);
    expect(registerSearchOptions(rows, "lot").map(o => o.value)).toEqual(["L-101", "L-102", "Winter Lot"]);
    expect(fields.find(field => field.key === "cityBranch")?.optionsFor?.({ country: "Pakistan", mainBranch: "Main PK" })).toEqual([{ value:"Karachi",label:"Karachi" }]);
    expect(fields.find(field => field.key === "loadingPort")?.optionsFor?.({ loadingCountry: "China" })).toEqual([{ value:"Ningbo",label:"Ningbo" }]);
  });
});

import React from "react";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const state=vi.hoisted(()=>({print:vi.fn()}));
vi.mock("@/lib/hooks/use-erp-scope",()=>({useErpScope:()=>({lockedCountryId:"pk",lockedCityBranchId:"chaman",userName:"Authorized user"})}));
vi.mock("@/lib/reports/open-scoped-report",()=>({openScopedGenericReport:state.print}));
const language={lang:"en",dir:"ltr",isRtl:false,textStart:"text-left",textEnd:"text-right",t:(_k:string,f:string)=>f,tGlobal:(_k:string,f:string)=>f};
vi.mock("@/lib/i18n/use-erp-screen",()=>({useErpScreen:()=>language}));
import { BillDrilldownView } from "@/features/expenses/components/bill-drilldown-view";
const loadingHistory=[{id:"first",sequence:1,loadingNo:"LR-1",loadedAt:"2026-11-01",containerNumber:"C-1",blNumber:"BL-1",quantity:200,grossWeight:220,netWeight:200,currency:"AED",finalAmount:7340,laneId:"lane-1",destination:"remaining_payment"},{id:"second",sequence:2,loadingNo:"LR-2",loadedAt:"2026-11-12",containerNumber:"C-2",blNumber:"BL-2",quantity:200,grossWeight:220,netWeight:200,currency:"AED",finalAmount:7340,laneId:"lane-2",destination:"general_purchase_expenses"}];
beforeEach(()=>{vi.stubGlobal("React",React);state.print.mockReset().mockResolvedValue(undefined);vi.stubGlobal("fetch",vi.fn(async()=>({ok:true,json:async()=>({ok:true,data:{functionalCurrency:"AED",bill:{billNo:"PO-10",billDate:"2026-10-31",branchLabel:"Chaman",sourceModule:"purchase_booking",party:{name:"Supplier",accountNo:"PUR-10"}},sourceBill:{purchaseAccountNo:"PUR-10",salesAccountNo:"SAL-20"},goods:[{row:1,name:"Walnuts",qty:1000,weightKgs:1000,grossWeightKgs:1100,rate:10,amount:10000}],loadingHistory,original:null,expenseLines:[],payments:[],drCrEntries:[],relatedSales:[],documents:[],audit:[],expenseTotals:{posted:0},cost:{originalBillFunctional:36700,postedExpenseTotal:0,landedCost:36700,unitLandedCost:36.7},quantity:{purchased:1000,sold:0,remaining:1000,remainingValue:36700},profitAndLoss:{revenue:0,profit:null}}})})));});
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
it("opens one original bill ledger with accounts and each later loading's own date and references",async()=>{
 render(<BillDrilldownView id="bill-10" />);
 const journal=await screen.findByTestId("bill-loading-journal");
 expect(screen.getAllByText("PUR-10").length).toBeGreaterThan(0);expect(screen.getByText("SAL-20")).toBeTruthy();
 expect(within(journal).getByText("PO-10 [1]")).toBeTruthy();expect(within(journal).getByText("PO-10 [2]")).toBeTruthy();
 expect(within(journal).getByText("01/11/2026")).toBeTruthy();expect(within(journal).getByText("12/11/2026")).toBeTruthy();
 expect(within(journal).getByText("BL-1")).toBeTruthy();expect(within(journal).getByText("BL-2")).toBeTruthy();
 expect(within(journal).getAllByRole("link")[1].getAttribute("href")).toContain("lane-2");
 expect(fetch).toHaveBeenCalledTimes(1);
});
it("prints the same loading rows and frozen bill total without posting anything",async()=>{
 render(<BillDrilldownView id="bill-10" />);await screen.findByTestId("bill-loading-journal");
 fireEvent.click(screen.getAllByRole("button",{name:"Print A4"})[1]);
 await waitFor(()=>expect(state.print).toHaveBeenCalledTimes(1));
 expect(state.print).toHaveBeenCalledWith(expect.objectContaining({rows:loadingHistory,orientation:"landscape",cityBranchId:"chaman",summary:expect.objectContaining({"Original Bill (Functional)":"AED 36,700.00"})}));
 expect(fetch).toHaveBeenCalledTimes(1);
});

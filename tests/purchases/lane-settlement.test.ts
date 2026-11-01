import { describe, expect, it } from "vitest";
import { laneSettlement } from "@/lib/purchases/lane-settlement";
import { finalCurrencyAmount } from "@/lib/purchases/final-currency";

describe("shared purchase/sales settlement", () => {
  it("allocates only the loaded value using the shared settlement rule", () => {
    const result = laneSettlement({ total: 1158750, quantity:22500,currency:"USD",finalCurrency:"AED",rate:3.67,advance:115875,paid:115875,loadings:[{id:"one",quantity:2250,value:115875}] })!;
    expect(result.states[0]).toMatchObject({ valueFC:115875,advanceAllocFC:11587.5,outstandingFC:104287.5 });
    expect(finalCurrencyAmount(result.states[0].outstandingFC,"USD","AED",3.67)).toBe(382735.13);
  });
  it("UAE domestic purchase does not reconvert an AED balance", () => {
    const r=laneSettlement({total:1000,quantity:10,currency:"AED",finalCurrency:"AED",rate:1,advance:200,paid:300,loadings:[{id:"one",quantity:5}]})!;
    expect(r.states[0].outstandingFC).toBe(300);
    expect(finalCurrencyAmount(r.states[0].outstandingFC,"AED","AED",1)).toBe(300);
  });
  it("weights unequal loads by value and applies additional receipts only once", () => {
    const r=laneSettlement({total:1000,quantity:10,currency:"USD",finalCurrency:"AED",rate:3.67,advance:200,paid:500,loadings:[{id:"a",quantity:5,value:700},{id:"b",quantity:5,value:300}]})!;
    expect(r.states.map(s=>s.outstandingFC)).toEqual([260,240]);
  });
  it("refuses inconsistent money or missing country conversion", () => {
    const row={total:1000,quantity:10,currency:"USD",finalCurrency:"AED",rate:3.67,advance:200,paid:100,loadings:[]};
    expect(laneSettlement(row)).toBeNull();
    expect(laneSettlement({...row,paid:200,rate:0})).toBeNull();
  });
});

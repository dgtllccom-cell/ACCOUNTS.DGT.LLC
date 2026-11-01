import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ErpSession } from "@/lib/auth/session";
const mocks=vi.hoisted(()=>({sql:vi.fn(),authorize:vi.fn()}));
vi.mock("@/lib/db/local-postgres",()=>({withLocalPg:(fn:(sql:unknown)=>unknown)=>fn(mocks.sql)}));
vi.mock("@/lib/api/scope-middleware",()=>({authorizeApiScope:mocks.authorize}));
import { laneSettlementPreview } from "@/lib/services/lane-settlement-preview";
const session={} as ErpSession;
const lanes=[{source_id:"source",loaded_quantity:5,net_weight:50}];

describe("settlement source adapters",()=>{
  beforeEach(()=>vi.clearAllMocks());
  it.each(["sales_booking","local_sales"])("uses original sales currency and verified receipts for %s",async source_type=>{
    mocks.sql.mockResolvedValueOnce([{id:"source",quantity:10,original_currency_code:"USD",currency_code:"AED",final_currency:"AED",exchange_rate:3.67,total_goods_original:1000,form_data:{form:{advancePercent:20}}}]).mockResolvedValueOnce(lanes).mockResolvedValueOnce([{payment_kind:"advance",currency_code:"AED",amount:734,base_currency_amount:734}]);
    const b=await laneSettlementPreview(session,{source_type,source_id:"source",purchase_ref_no:"S-1"});
    expect(b).toMatchObject({currency:"USD",localCurrency:"AED",advancePaid:200,totalPaid:200,paymentKnown:true});
    expect(b?.loadings[0]).toMatchObject({value:500,advanceAllocated:100,outstanding:400});
  });
  it.each([["AED",1],["USD",3.67]])("UAE local purchase in %s exposes unverified advance without inventing paid money",async(purchase_currency,exchange_rate)=>{
    mocks.sql.mockResolvedValueOnce([{id:"source",numbers:10,purchase_currency,final_currency:"AED",exchange_rate,final_cost:1000,advance_amount:200,remaining_balance:800}]).mockResolvedValueOnce(lanes);
    const b=await laneSettlementPreview(session,{source_type:"local_purchase",source_id:"source"});
    expect(b).toMatchObject({billTotal:1000,currency:purchase_currency,localCurrency:"AED",paymentKnown:false,advancePaid:null,outstanding:null});
    expect(b?.loadings[0].value).toBe(500);
  });
  it("checks the original source's financial scope before reading its payment rows",async()=>{
    mocks.sql.mockResolvedValueOnce([{id:"source",country_id:"other"}]);
    mocks.authorize.mockImplementationOnce(()=>{throw new Error("Forbidden");});
    await expect(laneSettlementPreview(session,{source_type:"sales_booking",source_id:"source"})).rejects.toThrow("Forbidden");
    expect(mocks.sql).toHaveBeenCalledOnce();
  });
});

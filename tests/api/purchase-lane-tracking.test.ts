// @vitest-environment node
import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const state=vi.hoisted(()=>({session:null as any,list:vi.fn()}));
vi.mock("@/lib/auth/session",()=>({requireErpSession:async()=>state.session}));
vi.mock("@/lib/services/purchase-lane-service",()=>({listPurchaseLaneTracking:state.list}));
vi.mock("@/lib/i18n/server",()=>({getRequestLanguage:async()=>"en"}));
vi.mock("@/lib/api/response",()=>({apiOk:(data:any)=>Response.json({ok:true,data}),handleApiError:(e:any)=>Response.json({error:e.message},{status:e.status||400})}));
import { GET } from "@/app/api/erp/purchases/lane/tracking/route";
beforeEach(()=>{state.list.mockReset().mockResolvedValue([{id:"assigned"}]);state.session={isSuperAdmin:false,roles:["staff_user"],permissions:["purchase_logistics:read"],countryIds:["pk"],cityBranchIds:["chaman"],countryBranchIds:["pk-main"],assignments:[],operationalDomains:["business"]};});
it("requires logistics read permission before querying the read-only feed",async()=>{state.session.permissions=["reports:read"];expect((await GET(new NextRequest("http://localhost/api/erp/purchases/lane/tracking"))).status).toBe(403);expect(state.list).not.toHaveBeenCalled();});
it("passes the authorized identity unchanged for row scope enforcement",async()=>{expect((await GET(new NextRequest("http://localhost/api/erp/purchases/lane/tracking?q=BL-1"))).status).toBe(200);expect(state.list).toHaveBeenCalledWith(state.session,{q:"BL-1"});});
it("rejects a malformed load identifier before any database access",async()=>{expect((await GET(new NextRequest("http://localhost/api/erp/purchases/lane/tracking?id=bad"))).status).toBe(400);expect(state.list).not.toHaveBeenCalled();});

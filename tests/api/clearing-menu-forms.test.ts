// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { CLEARING_MENU_PERMISSIONS } from "@/lib/permissions/clearing-menu";
const state = vi.hoisted(() => ({ session: null as any, row: null as any, queries: [] as any[] }));
vi.mock("@/lib/auth/session", () => ({ requireErpSession: async () => state.session }));
vi.mock("@/lib/db/local-postgres", () => ({ withLocalPg: async (fn: any) => {
  const sql: any = async (parts: TemplateStringsArray, ...values: any[]) => {
    const text = parts.join("?"); state.queries.push({ text, values });
    if (text.includes("count(*)")) return [{ c: 0 }];
    if (text.includes("select country_id")) return state.row ? [state.row] : [];
    return [{ id: "saved", agent_id: "agent", country_id: "pk", country_branch_id: "main", city_branch_id: "chaman" }];
  };
  return fn(sql);
} }));
vi.mock("@/lib/i18n/record-translation-sync", () => ({ syncRecordTranslations: async () => {} }));
vi.mock("@/lib/api/record-change-history", () => ({ writeRecordChangeHistory: async () => {} }));
vi.mock("@/lib/api/response", () => ({ rethrowIfNextControlFlow: () => {} }));
import { POST as saveDocument } from "@/app/api/erp/clearing-agent/agent-custom-entry/route";
import { POST as savePayment } from "@/app/api/erp/clearing-agent/payment-bill/route";
import { PATCH as editDocument } from "@/app/api/erp/clearing-agent/agent-custom-entry/[id]/route";
import { PATCH as editPayment } from "@/app/api/erp/clearing-agent/payment-bill/[id]/route";
const request = (body: any, method = "POST") => new NextRequest("http://localhost/api/erp/clearing-agent/agent-custom-entry", { method, body: JSON.stringify(body) });
beforeEach(() => {
  state.session = { userId: "staff", isSuperAdmin: false, roles: ["city_operations_admin"], permissions: [...CLEARING_MENU_PERMISSIONS], countryIds: ["pk"], countryBranchIds: ["main"], cityBranchIds: ["chaman"], clearingAgentIds: ["agent"], operationalDomains: ["shipping"], assignments: [] };
  state.queries = [];
  state.row = { agent_id: "agent", country_id: "pk", country_branch_id: "main", city_branch_id: "chaman" };
});
describe.each([["documents", saveDocument, editDocument], ["payment bill", savePayment, editPayment]] as const)("Clearing Agent %s backend", (_name, save, edit) => {
  it("saves within the assigned branch and automatically binds the existing agent", async () => {
    const response = await save(request({ agent_name: "Existing agent", customs_station: "Chaman" }));
    expect(response.status).toBe(200);
    const insert = state.queries.find((q) => q.text.includes("insert into"));
    expect(insert.values).toEqual(expect.arrayContaining(["pk", "main", "chaman", "agent", "staff"]));
  });
  it("refuses a different agent before any write", async () => {
    expect((await save(request({ agent_id: "foreign" }))).status).toBe(403);
    expect(state.queries).toHaveLength(0);
  });
  it("refuses another branch before any write", async () => {
    expect((await save(request({ city_branch_id: "quetta" }))).status).toBe(403);
    expect(state.queries).toHaveLength(0);
  });
  it("edits an assigned record, refusing reassignment to another agent", async () => {
    expect((await edit(request({ remarks: "Authorized update" }, "PATCH"), { params: Promise.resolve({ id: "saved" }) })).status).toBe(200);
    state.queries = [];
    expect((await edit(request({ agent_id: "foreign" }, "PATCH"), { params: Promise.resolve({ id: "saved" }) })).status).toBe(403);
    expect(state.queries.some((q) => /update public/.test(q.text))).toBe(false);
  });
  it("refuses a known foreign record ID without updating it", async () => {
    state.row.agent_id = "foreign";
    expect((await edit(request({ remarks: "Rejected" }, "PATCH"), { params: Promise.resolve({ id: "foreign-id" }) })).status).toBe(403);
    expect(state.queries.some((q) => /update public/.test(q.text))).toBe(false);
  });
});

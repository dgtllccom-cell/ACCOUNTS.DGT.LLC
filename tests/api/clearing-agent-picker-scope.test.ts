// @vitest-environment node
import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const state = vi.hoisted(() => ({ getById: vi.fn(), search: vi.fn(), session: null as any }));
vi.mock("@/lib/auth/session", () => ({ requireErpSession: async () => state.session }));
vi.mock("@/lib/repositories/clearing-agents-repository", () => ({ clearingAgentsRepository: { getById: state.getById, search: state.search } }));
vi.mock("@/lib/api/response", async () => ({ apiOk: (body: any) => Response.json(body), apiCreated: (body: any) => Response.json(body), apiError: () => Response.json({}), handleApiError: () => Response.json({}, { status: 500 }) }));
vi.mock("@/lib/i18n/server", () => ({ getRequestLanguage: async () => "en" }));
vi.mock("@/lib/i18n/localize-records", () => ({ localizeRecordNames: async (rows: any) => rows }));
vi.mock("@/lib/services/translation-trigger-service", () => ({ translateMasterRecord: async () => {} }));
import { GET } from "@/app/api/erp/clearing-agents/route";
beforeEach(() => {
  state.getById.mockReset().mockResolvedValue({ id: "assigned-agent", name: "Naseebullah" });
  state.search.mockReset().mockResolvedValue({ clearingAgents: [{ id: "other-agent" }] });
  state.session = { isSuperAdmin: false, clearingAgentIds: ["assigned-agent"], permissions: ["clearing_menu:restricted"] };
});
it("loads the assigned master directly so pagination cannot hide it", async () => {
  const response = await GET(new NextRequest("http://localhost/api/erp/clearing-agents?limit=1"));
  expect(await response.json()).toMatchObject({ clearingAgents: [{ id: "assigned-agent" }], total: 1 });
  expect(state.getById).toHaveBeenCalledWith("assigned-agent");
  expect(state.search).not.toHaveBeenCalled();
});
it("keeps the existing master search behavior for other users", async () => {
  state.session.permissions = ["clearing_agents:read"];
  expect((await GET(new NextRequest("http://localhost/api/erp/clearing-agents?limit=1"))).status).toBe(200);
  expect(state.search).toHaveBeenCalledWith({ query: null, limit: 1 });
  expect(state.getById).not.toHaveBeenCalled();
});

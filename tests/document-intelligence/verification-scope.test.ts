import { describe, expect, it, vi } from "vitest";
const data = vi.hoisted(() => ({ consumed: [] as any[] }));
vi.mock("@/lib/db/local-postgres", () => ({ withReadPg: async (fn: any) => fn(Object.assign(async (parts: TemplateStringsArray) => {
  const text = parts.join("?");
  if (text.includes("SELECT * FROM public.document_intake_jobs")) return [{ id: "job", job_no: "DOC-1", country_id: "PK", city_branch_id: "Q", file_sha256: "hash", operational_domain: "business" }];
  if (text.includes("FROM public.document_intake_drafts")) return data.consumed;
  return [];
}, { unsafe: (s: string) => s })) }));
import { verifyIntakeJob } from "@/lib/document-intelligence/verification";
const scope = { domain: "business", countryIds: ["PK"], countryBranchIds: null, cityBranchIds: ["Q"], clearingAgentIds: null, isSuperAdmin: false } as const;
describe("Document duplicate warnings keep other branches private", () => {
  it("does not disclose consumed copies from another branch", async () => {
    data.consumed = [{ job_no: "PRIVATE-OTHER-BRANCH", country_id: "PK", city_branch_id: "C", operational_domain: "business", consumed_source_module: "purchase_orders" }];
    const result = await verifyIntakeJob("job", scope as any, {} as any);
    expect(result?.checks.find((c) => c.code === "already_used_document")).toMatchObject({ status: "pass" });
    expect(JSON.stringify(result)).not.toContain("PRIVATE-OTHER-BRANCH");
  });
  it("warns about a consumed copy inside the authorized branch", async () => {
    data.consumed = [{ job_no: "DOC-OLD", country_id: "PK", city_branch_id: "Q", operational_domain: "business", consumed_source_module: "purchase_orders" }];
    const result = await verifyIntakeJob("job", scope as any, {} as any);
    expect(result?.checks.find((c) => c.code === "already_used_document")).toMatchObject({ status: "fail", found: "DOC-OLD → purchase_orders" });
  });
});

import { documentIntakeService } from "../lib/services/document-intake-service";
import { withLocalPg } from "../lib/db/local-postgres";
import type { IntakeScope } from "../lib/document-intelligence/scope";
import sharp from "sharp";
const G: IntakeScope = { domain: null, countryIds: null, countryBranchIds: null, cityBranchIds: null, clearingAgentIds: null, isSuperAdmin: true };
const A = "00000000-0000-0000-0000-000000000000";
// UAE job, Pakistan-scoped reader
const UAE = "935dd0b9-8228-43b3-b53d-c06e9ae2882f", PK_C = "fb021716-a2e7-4141-9c1a-bd1ddd92eb14";
const PK: IntakeScope = { domain: "business", countryIds: [PK_C], countryBranchIds: null, cityBranchIds: null, clearingAgentIds: null, isSuperAdmin: false };
const buf = await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="600" height="200"><rect width="100%" height="100%" fill="white"/><text x="20" y="60" font-size="24">SCOPE TEST INVOICE</text></svg>`)).png().toBuffer();
const j = await documentIntakeService.createJob({ operationalDomain: "business", countryId: UAE }, { buffer: buf, declaredMime: "image/png", filename: "scope.png" }, A, "S11", G);
console.log("created UAE job", j.jobNo);
// Pakistan-scoped list
const list = await documentIntakeService.list(PK, {});
console.log("PK list contains the UAE job?", list.some((r: any) => r.id === j.id), "(want false)");
// Pakistan-scoped direct get
let blocked = false;
try { const r = await documentIntakeService.get(j.id, PK); blocked = !r; } catch (e: any) { blocked = /scope|permission|authorized|outside/i.test(e.message); }
console.log("PK direct get blocked?", blocked, "(want true)");
await withLocalPg(async (sql) => sql`DELETE FROM public.document_intake_jobs WHERE id = ${j.id}`);
console.log(blocked && !list.some((r: any) => r.id === j.id) ? "\n11. cross-scope access blocked: PASS" : "\n11: FAIL");
process.exit(0);

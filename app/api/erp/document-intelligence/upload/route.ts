import type { NextRequest } from "next/server";
import { z } from "zod";
import { apiCreated, handleApiError, apiError } from "@/lib/api/response";
import { guardIntake } from "@/lib/services/document-intake-api";
import { documentIntakeService } from "@/lib/services/document-intake-service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const revalidate = 0;

const metaSchema = z.object({
  operationalDomain: z.enum(["business", "shipping"]),
  companyId: z.string().uuid().nullish(),
  countryId: z.string().uuid().nullish(),
  countryBranchId: z.string().uuid().nullish(),
  cityBranchId: z.string().uuid().nullish(),
  clearingAgentId: z.string().uuid().nullish(),
  shippingCustomerId: z.string().uuid().nullish(),
  purchaseOrderId: z.string().uuid().nullish(),
  salesOrderId: z.string().uuid().nullish(),
  sourceModuleHint: z.string().trim().max(60).nullish(),
  contractReference: z.string().trim().max(120).nullish(),
  documentReference: z.string().trim().max(120).nullish(),
  containerReference: z.string().trim().max(200).nullish(),
  blReference: z.string().trim().max(120).nullish(),
  uploadMethod: z.enum(["web", "scanner_bridge", "mobile", "api"]).optional(),
  idempotencyKey: z.string().trim().max(120).nullish(),
});

export async function POST(request: NextRequest) {
  try {
    const ct = request.headers.get("content-type") || "";
    if (!ct.includes("multipart/form-data")) return apiError("VALIDATION", "Upload must be multipart/form-data with a 'file' part.", 400);
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return apiError("VALIDATION", "Missing 'file' part.", 400);

    const rawMeta: Record<string, unknown> = {};
    for (const [k, v] of form.entries()) if (k !== "file" && typeof v === "string") rawMeta[k] = v === "" ? undefined : v;
    const meta = metaSchema.parse(rawMeta);

    const { session, scope } = await guardIntake("write", meta.operationalDomain);
    const buffer = Buffer.from(await file.arrayBuffer());
    const res = await documentIntakeService.createJob(
      meta,
      { buffer, declaredMime: file.type || "application/octet-stream", filename: file.name || "document" },
      session.userId,
      session.fullName ?? null,
      scope,
    );
    return apiCreated({ job: res });
  } catch (error) {
    return handleApiError(error);
  }
}

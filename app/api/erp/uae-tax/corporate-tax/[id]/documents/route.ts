import { NextRequest } from "next/server";
import { z } from "zod";
import { apiOk, handleApiError } from "@/lib/api/response";
import { guardUaeTax } from "@/lib/services/uae-tax-api";
import { setDocument } from "@/lib/services/uae-corporate-tax-service";

export const dynamic = "force-dynamic";

/** Document checklist: mark evidence received (linked to the Document Manager) / missing / n.a. */
export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { session, scope } = await guardUaeTax("write");
    const { id } = z.object({ id: z.string().uuid() }).parse(await ctx.params);
    const b = z.object({
      docKey: z.string(),
      status: z.enum(["missing", "received", "not_applicable"]),
      documentId: z.string().uuid().nullish(),
      notes: z.string().trim().max(1000).nullish(),
    }).parse(await request.json());
    return apiOk(await setDocument(session, scope, id, b));
  } catch (error) {
    return handleApiError(error);
  }
}

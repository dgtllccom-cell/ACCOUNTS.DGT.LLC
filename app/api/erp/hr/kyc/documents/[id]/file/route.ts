import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { guardHrKyc } from "@/lib/services/hr-api";
import { hrKycService } from "@/lib/services/hr-kyc-service";
import { serveOfficeDocumentFile } from "@/lib/documents/document-file";
import { handleApiError } from "@/lib/api/response";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

const idSchema = z.object({ id: z.string().uuid() });

/**
 * GET /api/erp/hr/kyc/documents/[id]/file[?disposition=attachment]
 *
 * The stored scan of ONE employee KYC document (passport, ID card, visa ...). Opens inline by default so the checklist can preview it.
 * Access = the HR KYC view right (an HR reader inside the HR scope, or the employee himself) AND the identifier right (read-only roles see the
 * checklist but never the scan). A document outside the login scope answers 404 - its existence is not confirmed. Every open is audited.
 */
export async function GET(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { session, scope, caps } = await guardHrKyc("read");
    const { id } = idSchema.parse(await ctx.params);
    if (!caps.identifiers) return NextResponse.json({ error: "Identity documents are not available to this role." }, { status: 403 });
    const officeDocumentId = await hrKycService.fileOfficeDocumentId(id, scope);
    if (!officeDocumentId) return NextResponse.json({ error: "Document not found" }, { status: 404 });
    const disposition = request.nextUrl.searchParams.get("disposition") === "attachment" ? "attachment" : "inline";
    const { auditApiAction } = await import("@/lib/api/audit");
    auditApiAction(request as never, { action: "hr.kyc.document.view", entityTable: "hr_employee_kyc_documents", entityId: id, after: { by: session.userId, disposition } }).catch(() => {});
    return serveOfficeDocumentFile(officeDocumentId, disposition);
  } catch (error) {
    return handleApiError(error);
  }
}

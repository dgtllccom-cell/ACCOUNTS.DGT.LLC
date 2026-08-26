import { NextRequest } from "next/server";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { erpDocuments, erpDocumentVersions } from "@/lib/db/schema";
import { requireErpSession } from "@/lib/auth/session";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import { apiOk, handleApiError, apiError } from "@/lib/api/response";
import { resolveDocumentFileUrl } from "@/lib/documents/document-storage";

const downloadSchema = z.object({
  id: z.string().uuid(),
  versionId: z.string().uuid().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const session = await requireErpSession();
    authorizeApiScope(session, { resource: "attachments", action: "read" });
    const { searchParams } = new URL(request.url);

    const query = downloadSchema.parse({
      id: searchParams.get("id"),
      versionId: searchParams.get("versionId") || undefined,
    });

    // Verify document access
    const doc = await db.query.erpDocuments.findFirst({
      where: and(
        eq(erpDocuments.id, query.id),
        eq(erpDocuments.companyId, session.companyId)
      ),
    });

    if (!doc) {
      return apiError("Document not found", 404);
    }

    let version;
    if (query.versionId) {
      version = await db.query.erpDocumentVersions.findFirst({
        where: and(
          eq(erpDocumentVersions.id, query.versionId),
          eq(erpDocumentVersions.documentId, doc.id)
        ),
      });
    } else {
      const versions = await db.query.erpDocumentVersions.findMany({
        where: eq(erpDocumentVersions.documentId, doc.id),
      });
      version = versions.sort((a, b) => b.versionNumber - a.versionNumber)[0];
    }

    if (!version) {
      return apiError("Document version not found", 404);
    }

    const resolvedUrl = await resolveDocumentFileUrl(version.path);
    if (!resolvedUrl) {
      return apiError("Failed to generate download URL", 500);
    }

    return apiOk({ url: resolvedUrl });
  } catch (error) {
    return handleApiError(error);
  }
}

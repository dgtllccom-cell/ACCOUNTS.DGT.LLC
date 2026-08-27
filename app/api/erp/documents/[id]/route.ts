import { NextRequest } from "next/server";
import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { erpDocuments, erpDocumentVersions, auditLogs } from "@/lib/db/schema";
import { requireErpSession } from "@/lib/auth/session";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import { apiOk, handleApiError, apiError } from "@/lib/api/response";
import { deleteDocumentBlob } from "@/lib/documents/document-storage";

function jsonSafe<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireErpSession();
    authorizeApiScope(session, { resource: "attachments", action: "delete" });
    const { id } = await params;

    // Fetch the document and its versions
    const doc = await db.query.erpDocuments.findFirst({
      where: eq(erpDocuments.id, id),
    });

    if (!doc) {
      return apiError("NOT_FOUND", "Document not found", 404);
    }

    // Permission check: Must be super_admin OR the uploader
    const isSuperAdmin = session.roles?.includes("super_admin");
    if (!isSuperAdmin && doc.uploadedBy !== session.userId) {
      return apiError("FORBIDDEN", "You do not have permission to delete this document", 403);
    }

    const versions = await db.query.erpDocumentVersions.findMany({
      where: eq(erpDocumentVersions.documentId, id),
    });
    await Promise.all(versions.map((version) => deleteDocumentBlob(version.path)));

    await db.transaction(async (tx) => {
      await tx.delete(erpDocuments).where(eq(erpDocuments.id, id));
      
      await tx.insert(auditLogs).values({
        companyId: doc.companyId,
        actorId: session.userId,
        action: "delete_document",
        entityTable: "erp_documents",
        entityId: doc.id,
        before: jsonSafe({ document: doc }),
      });
    });

    return apiOk({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}

import { NextRequest } from "next/server";
import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { erpDocuments, erpDocumentVersions, auditLogs } from "@/lib/db/schema";
import { requireErpSession } from "@/lib/auth/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { apiOk, handleApiError, apiError } from "@/lib/api/response";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireErpSession();
    const { id } = await params;

    // Fetch the document and its versions
    const doc = await db.query.erpDocuments.findFirst({
      where: and(
        eq(erpDocuments.id, id),
        eq(erpDocuments.companyId, session.companyId)
      ),
    });

    if (!doc) {
      return apiError("Document not found", 404);
    }

    // Permission check: Must be super_admin OR the uploader
    const isSuperAdmin = session.roles?.includes("super_admin");
    if (!isSuperAdmin && doc.uploadedBy !== session.user.id) {
      return apiError("You do not have permission to delete this document", 403);
    }

    const versions = await db.query.erpDocumentVersions.findMany({
      where: eq(erpDocumentVersions.documentId, id),
    });

    const supabase = createSupabaseAdminClient();
    
    // Delete files from Supabase Storage
    const pathsToDelete = versions.map((v) => v.path);
    if (pathsToDelete.length > 0) {
      const { error: storageError } = await supabase.storage
        .from(versions[0].bucket)
        .remove(pathsToDelete);

      if (storageError) {
        console.error("Storage delete error:", storageError);
        // Continue deleting from DB even if storage cleanup fails to avoid orphaned DB records
      }
    }

    await db.transaction(async (tx) => {
      await tx.delete(erpDocuments).where(eq(erpDocuments.id, id));
      
      await tx.insert(auditLogs).values({
        companyId: session.companyId,
        actorId: session.user.id,
        action: "delete_document",
        entityTable: "erp_documents",
        entityId: doc.id,
        before: { document: doc },
      });
    });

    return apiOk({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}

import { NextRequest } from "next/server";
import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { erpDocuments, erpDocumentVersions, auditLogs } from "@/lib/db/schema";
import { requireErpSession } from "@/lib/auth/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { apiOk, handleApiError, apiError } from "@/lib/api/response";

const BUCKET_NAME = "erp-documents";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireErpSession();
    const { id } = await params;

    const doc = await db.query.erpDocuments.findFirst({
      where: and(
        eq(erpDocuments.id, id),
        eq(erpDocuments.companyId, session.companyId)
      ),
    });

    if (!doc) {
      return apiError("Document not found", 404);
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return apiError("Missing required field (file)", 400);
    }

    if (file.size > 20 * 1024 * 1024) {
      return apiError("File size exceeds 20MB limit", 400);
    }

    const versions = await db.query.erpDocumentVersions.findMany({
      where: eq(erpDocumentVersions.documentId, id),
    });
    const latestVersion = versions.sort((a, b) => b.versionNumber - a.versionNumber)[0];
    const newVersionNumber = (latestVersion?.versionNumber || 0) + 1;

    const supabase = createSupabaseAdminClient();
    
    // Create random filename
    const ext = file.name.split(".").pop();
    const randomName = crypto.randomUUID();
    const filePath = `${session.companyId}/${doc.entityType}/${doc.entityId}/${randomName}.${ext}`;

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const { error: uploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(filePath, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      throw new Error(`Upload failed: ${uploadError.message}`);
    }

    const result = await db.transaction(async (tx) => {
      // Update main document stats
      await tx.update(erpDocuments)
        .set({
          mimeType: file.type,
          sizeBytes: file.size,
          updatedAt: new Date(),
        })
        .where(eq(erpDocuments.id, id));

      // Insert new version
      const [version] = await tx.insert(erpDocumentVersions).values({
        documentId: doc.id,
        versionNumber: newVersionNumber,
        bucket: BUCKET_NAME,
        path: filePath,
        mimeType: file.type,
        sizeBytes: file.size,
        uploadedBy: session.user.id,
      }).returning();

      await tx.insert(auditLogs).values({
        companyId: session.companyId,
        actorId: session.user.id,
        action: "update_document_version",
        entityTable: "erp_documents",
        entityId: doc.id,
        after: { document: doc, version },
      });

      return { doc, latestVersion: version };
    });

    return apiOk(result, 201);
  } catch (error) {
    return handleApiError(error);
  }
}

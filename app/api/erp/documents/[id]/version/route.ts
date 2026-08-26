import { NextRequest } from "next/server";
import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { erpDocuments, erpDocumentVersions, auditLogs } from "@/lib/db/schema";
import { requireErpSession } from "@/lib/auth/session";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import { apiOk, handleApiError, apiError } from "@/lib/api/response";
import { saveDocumentBlob } from "@/lib/documents/document-storage";

const BUCKET_NAME = "erp-documents";

function jsonSafe<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireErpSession();
    authorizeApiScope(session, { resource: "attachments", action: "create" });
    const { id } = await params;
    const sessionCompanyId = (session as { companyId?: string }).companyId ?? null;

    const doc = await db.query.erpDocuments.findFirst({
      where: eq(erpDocuments.id, id),
    });

    if (!doc) {
      return apiError("Document not found", 404);
    }
    const isSuperAdmin = session.roles?.includes("super_admin");
    if (!isSuperAdmin && sessionCompanyId && doc.companyId !== sessionCompanyId) {
      return apiError("You do not have permission to update this document", 403);
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

    // Create random filename
    const ext = file.name.split(".").pop();
    const randomName = crypto.randomUUID();
    const filePath = `${doc.companyId}/${doc.entityType}/${doc.entityId}/${randomName}.${ext}`;

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const uploadResult = await saveDocumentBlob({
      storageKey: filePath,
      buffer,
      contentType: file.type,
      upsert: false
    });

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
        path: uploadResult.storageKey,
        mimeType: file.type,
        sizeBytes: file.size,
        uploadedBy: session.userId,
      }).returning();

      await tx.insert(auditLogs).values({
        companyId: doc.companyId,
        actorId: session.userId,
        action: "update_document_version",
        entityTable: "erp_documents",
        entityId: doc.id,
        after: jsonSafe({ document: doc, version }),
      });

      return { doc, latestVersion: version };
    });

    return apiOk(result, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { erpDocuments, erpDocumentVersions } from "@/lib/db/schema";
import { requireErpSession } from "@/lib/auth/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { apiOk, handleApiError, apiError } from "@/lib/api/response";

const BUCKET_NAME = "erp-documents";

const listSchema = z.object({
  entityType: z.string().min(1),
  entityId: z.string().uuid(),
});

export async function GET(request: NextRequest) {
  try {
    const session = await requireErpSession();
    const { searchParams } = new URL(request.url);

    const query = listSchema.parse({
      entityType: searchParams.get("entityType"),
      entityId: searchParams.get("entityId"),
    });

    const docs = await db.query.erpDocuments.findMany({
      where: and(
        eq(erpDocuments.entityType, query.entityType),
        eq(erpDocuments.entityId, query.entityId),
        eq(erpDocuments.companyId, session.companyId)
      ),
      orderBy: (docs, { desc }) => [desc(docs.createdAt)],
    });

    // Also fetch versions for all these docs to include version count
    const docIds = docs.map((d) => d.id);
    const versions = docIds.length > 0 
      ? await db.query.erpDocumentVersions.findMany({
          where: (v, { inArray }) => inArray(v.documentId, docIds),
        })
      : [];

    const results = docs.map((doc) => {
      const docVersions = versions.filter((v) => v.documentId === doc.id);
      const latestVersion = docVersions.sort((a, b) => b.versionNumber - a.versionNumber)[0];
      return {
        ...doc,
        versionCount: docVersions.length,
        latestVersion,
        versions: docVersions.sort((a, b) => b.versionNumber - a.versionNumber),
      };
    });

    return apiOk({ results });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireErpSession();
    const formData = await request.formData();

    const file = formData.get("file") as File | null;
    const entityType = formData.get("entityType") as string;
    const entityId = formData.get("entityId") as string;

    if (!file || !entityType || !entityId) {
      return apiError("Missing required fields (file, entityType, entityId)", 400);
    }

    if (file.size > 20 * 1024 * 1024) { // 20MB limit
      return apiError("File size exceeds 20MB limit", 400);
    }

    const allowedTypes = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "image/jpeg",
      "image/png",
      "image/webp",
      "application/zip"
    ];

    if (!allowedTypes.includes(file.type)) {
      return apiError("Invalid file type", 400);
    }

    const supabase = createSupabaseAdminClient();
    
    // Create random filename
    const ext = file.name.split(".").pop();
    const randomName = crypto.randomUUID();
    const filePath = `${session.companyId}/${entityType}/${entityId}/${randomName}.${ext}`;

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
      const [doc] = await tx.insert(erpDocuments).values({
        companyId: session.companyId,
        countryId: session.countryId,
        cityBranchId: session.cityBranchId,
        name: file.name,
        entityType,
        entityId,
        mimeType: file.type,
        sizeBytes: file.size,
        uploadedBy: session.user.id,
      }).returning();

      const [version] = await tx.insert(erpDocumentVersions).values({
        documentId: doc.id,
        versionNumber: 1,
        bucket: BUCKET_NAME,
        path: filePath,
        mimeType: file.type,
        sizeBytes: file.size,
        uploadedBy: session.user.id,
      }).returning();

      await tx.insert(auditLogs).values({
        companyId: session.companyId,
        actorId: session.user.id,
        action: "upload_document",
        entityTable: "erp_documents",
        entityId: doc.id,
        after: { document: doc, version },
      });

      return { doc, latestVersion: version, versionCount: 1, versions: [version] };
    });

    return apiOk(result, 201);
  } catch (error) {
    return handleApiError(error);
  }
}

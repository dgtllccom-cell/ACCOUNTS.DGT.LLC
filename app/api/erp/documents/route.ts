import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { erpDocuments, erpDocumentVersions, auditLogs } from "@/lib/db/schema";
import { requireErpSession } from "@/lib/auth/session";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import { apiOk, handleApiError, apiError } from "@/lib/api/response";
import { saveDocumentBlob } from "@/lib/documents/document-storage";

const BUCKET_NAME = "erp-documents";

const listSchema = z.object({
  entityType: z.string().min(1),
  entityId: z.string().uuid(),
});

function readFormText(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value : "";
}

export async function GET(request: NextRequest) {
  try {
    const session = await requireErpSession();
    authorizeApiScope(session, { resource: "attachments", action: "read" });
    const { searchParams } = new URL(request.url);

    const query = listSchema.parse({
      entityType: searchParams.get("entityType"),
      entityId: searchParams.get("entityId"),
    });
    const companyId =
      searchParams.get("companyId") ||
      searchParams.get("company_id") ||
      (query.entityType === "company" ? query.entityId : null);

    const docs = await db.query.erpDocuments.findMany({
      where: and(
        eq(erpDocuments.entityType, query.entityType),
        eq(erpDocuments.entityId, query.entityId),
        companyId ? eq(erpDocuments.companyId, companyId) : eq(erpDocuments.companyId, query.entityId)
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
    authorizeApiScope(session, { resource: "attachments", action: "create" });
    const formData = await request.formData();

    const file = formData.get("file") as File | null;
    const entityType = readFormText(formData.get("entityType"));
    const entityId = readFormText(formData.get("entityId"));
    const companyId =
      readFormText(formData.get("companyId")) ||
      readFormText(formData.get("company_id")) ||
      (entityType === "company" ? entityId : null);
    const sessionCountryId = (session as { countryId?: string; countryIds?: string[] }).countryId ?? session.countryIds?.[0] ?? null;
    const sessionCityBranchId = (session as { cityBranchId?: string; cityBranchIds?: string[] }).cityBranchId ?? session.cityBranchIds?.[0] ?? null;

    if (!file || !entityType || !entityId) {
      return apiError("Missing required fields (file, entityType, entityId)", 400);
    }

    if (!companyId) {
      return apiError("Missing required field (companyId or company_id)", 400);
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

    // Create random filename
    const ext = file.name.split(".").pop();
    const randomName = crypto.randomUUID();
    const filePath = `${companyId}/${entityType}/${entityId}/${randomName}.${ext}`;

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const uploadResult = await saveDocumentBlob({
      storageKey: filePath,
      buffer,
      contentType: file.type,
      upsert: false
    });

    const result = await db.transaction(async (tx) => {
      const [doc] = await tx.insert(erpDocuments).values({
        companyId,
        countryId: sessionCountryId,
        cityBranchId: sessionCityBranchId,
        name: file.name,
        entityType,
        entityId,
        mimeType: file.type,
        sizeBytes: file.size,
        uploadedBy: session.userId,
      }).returning();

      const [version] = await tx.insert(erpDocumentVersions).values({
        documentId: doc.id,
        versionNumber: 1,
        bucket: BUCKET_NAME,
        path: uploadResult.storageKey,
        mimeType: file.type,
        sizeBytes: file.size,
        uploadedBy: session.userId,
      }).returning();

      await tx.insert(auditLogs).values({
        companyId,
        actorId: session.userId,
        action: "upload_document",
        entityTable: "erp_documents",
        entityId: doc.id,
        after: { document: doc, version },
      });

      return { doc, latestVersion: version, versionCount: 1, versions: [version] };
    });

    return apiOk(result, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}

import { NextRequest } from "next/server";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { erpDocuments, erpDocumentVersions } from "@/lib/db/schema";
import { requireErpSession } from "@/lib/auth/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { apiOk, handleApiError, apiError } from "@/lib/api/response";

const downloadSchema = z.object({
  id: z.string().uuid(),
  versionId: z.string().uuid().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const session = await requireErpSession();
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

    const supabase = createSupabaseAdminClient();
    
    // Create a 5-minute signed URL
    const { data, error } = await supabase.storage
      .from(version.bucket)
      .createSignedUrl(version.path, 300, {
        download: doc.name,
      });

    if (error || !data) {
      return apiError("Failed to generate download URL", 500);
    }

    return apiOk({ url: data.signedUrl });
  } catch (error) {
    return handleApiError(error);
  }
}

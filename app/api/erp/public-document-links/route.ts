/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * POST /api/erp/public-document-links
 *
 * Saves a snapshot of ONE invoice the signed-in user is printing and returns a
 * public link to it. The link carries a random 192-bit token (no login needed to
 * open it). The snapshot is exactly what was printed, so the public page shows
 * the same document. Revoke a link by setting revoked_at on its row.
 */

import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { requireErpSession } from "@/lib/auth/session";
import { withLocalPg } from "@/lib/db/local-postgres";
import { rethrowIfNextControlFlow } from "@/lib/api/response";

export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 4 * 1024 * 1024;

function publicOrigin(request: NextRequest): string {
  const proto = request.headers.get("x-forwarded-proto") || "https";
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host") || request.nextUrl.host;
  return `${proto}://${host}`;
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireErpSession();
    const raw = await request.text();
    if (raw.length > MAX_BODY_BYTES) {
      return NextResponse.json({ ok: false, error: "Document is too large to publish" }, { status: 413 });
    }

    let body: any;
    try {
      body = JSON.parse(raw);
    } catch {
      return NextResponse.json({ ok: false, error: "Invalid request body" }, { status: 400 });
    }

    const snapshot = body?.snapshot;
    if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) {
      return NextResponse.json({ ok: false, error: "Missing document" }, { status: 400 });
    }

    const templateId = String(body.templateId || "classic").slice(0, 40);
    const colorId = typeof body.colorId === "string" ? body.colorId.slice(0, 20) : null;
    const flags = body.flags && typeof body.flags === "object" && !Array.isArray(body.flags) ? body.flags : {};
    const docNo = String(body.docNo || snapshot.docNo || "").slice(0, 120);
    const docType = String(snapshot.docType || "").slice(0, 60);
    // 24 random bytes -> 32 base64url characters (192 bits). Kept short so the QR code stays version 4.
    const token = randomBytes(24).toString("base64url");

    const saved = await withLocalPg(async (sql) => {
      await sql`
        insert into public.public_document_links
          (token, document_type, doc_no, template_id, color_id, flags, snapshot, created_by)
        values
          (${token}, ${docType}, ${docNo}, ${templateId}, ${colorId},
           ${JSON.stringify(flags)}::jsonb, ${JSON.stringify(snapshot)}::jsonb, ${session.userId ?? null})
      `;
      return true;
    });
    if (!saved) {
      return NextResponse.json({ ok: false, error: "Database unavailable" }, { status: 503 });
    }

    return NextResponse.json(
      { ok: true, data: { url: `${publicOrigin(request)}/i/${token}` } },
      { status: 201 },
    );
  } catch (error) {
    rethrowIfNextControlFlow(error);
    return NextResponse.json({ ok: false, error: "Could not create the public link" }, { status: 500 });
  }
}

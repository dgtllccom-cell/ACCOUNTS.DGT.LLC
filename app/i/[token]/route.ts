/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * GET /i/[token]  (short link; a shorter URL keeps the QR code small enough to scan)
 *
 * Public, read-only view of ONE printed invoice (the saved snapshot). No login.
 * The token is random (192 bits); unknown or revoked tokens get a plain 404.
 * Responses are marked noindex and not cached.
 */

import { NextRequest } from "next/server";
import { withLocalPg } from "@/lib/db/local-postgres";
import { renderInvoiceHtml } from "@/lib/reports/invoice-templates/render-invoice-html";
import { DEFAULT_TEMPLATE_FLAGS } from "@/lib/reports/invoice-templates/types";

export const dynamic = "force-dynamic";

const TOKEN_RE = /^[A-Za-z0-9_-]{32}$/;
const NOINDEX = "noindex, nofollow, noarchive";

function notFound(): Response {
  return new Response("Not found", {
    status: 404,
    headers: { "Content-Type": "text/plain; charset=utf-8", "X-Robots-Tag": NOINDEX, "Cache-Control": "no-store" },
  });
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!TOKEN_RE.test(token)) return notFound();

  const row = await withLocalPg(async (sql) => {
    const rows = await sql<any[]>`
      select template_id, color_id, flags, snapshot
      from public.public_document_links
      where token = ${token} and revoked_at is null
      limit 1
    `;
    return rows[0] ?? null;
  });
  if (!row) return notFound();

  const snapshot = typeof row.snapshot === "string" ? JSON.parse(row.snapshot) : row.snapshot;
  const storedFlags = typeof row.flags === "string" ? JSON.parse(row.flags) : row.flags;
  const flags = { ...DEFAULT_TEMPLATE_FLAGS, ...(storedFlags || {}) };
  const proto = request.headers.get("x-forwarded-proto") || "https";
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host") || request.nextUrl.host;
  const input = { ...snapshot, publicUrl: `${proto}://${host}/i/${token}` };

  const html = renderInvoiceHtml(input, row.template_id || "classic", flags, row.color_id);
  return new Response(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "X-Robots-Tag": NOINDEX,
      "Cache-Control": "private, no-store",
      "Referrer-Policy": "no-referrer",
    },
  });
}

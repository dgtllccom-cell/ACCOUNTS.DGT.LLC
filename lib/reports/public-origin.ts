import type { NextRequest } from "next/server";

/**
 * The origin a QR code links to. A phone can only open a public host, so a link is never built on localhost:
 * the request's host is used over https (behind the production proxy the host header is the public domain).
 * PUBLIC_APP_URL, when set, overrides it. Local development keeps its own host (a phone cannot reach it).
 */
export function publicOriginFor(request: NextRequest): string {
  const configured = (process.env.PUBLIC_APP_URL || "").trim().replace(/\/+$/, "");
  if (configured) return configured;
  const host = (request.headers.get("x-forwarded-host") || request.headers.get("host") || request.nextUrl.host)
    .split(",")[0]
    .trim();
  const local = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i.test(host);
  if (local) return `${request.nextUrl.protocol.replace(":", "") || "http"}://${host}`;
  return `https://${host}`;
}

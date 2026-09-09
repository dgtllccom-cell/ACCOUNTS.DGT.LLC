/**
 * Edge-safe read of the ERP session cookie — Web Crypto only, no `node:crypto`,
 * so `middleware.ts` can consult it without dragging Node built-ins into the
 * Edge bundle. It ONLY extracts the (non-sensitive) mobile access profile after
 * verifying the cookie's HMAC; full session resolution still happens server-side
 * in `getCurrentErpSession()`.
 *
 * Token format (see lib/auth/temp-session.ts):
 *   base64url(JSON payload) + "." + base64url(HMAC-SHA256(payloadB64, secret))
 */

function b64urlToBytes(s: string): ArrayBuffer {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (s.length % 4)) % 4);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out.buffer;
}

function sessionSecret(): string | null {
  return (
    process.env.ERP_SESSION_SECRET ||
    process.env.AUTH_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    null
  );
}

export type EdgeMobileProfile = "standard" | "mobile_cash_ledger" | "mobile_field";

/**
 * Returns the verified mobile profile from the session cookie, or null when the
 * cookie is absent / unverifiable / not a temp session. A non-"standard" result
 * is only ever returned for a cookie whose HMAC checks out.
 */
export async function readMobileProfileFromToken(token: string | undefined | null): Promise<EdgeMobileProfile | null> {
  if (!token || token.indexOf(".") === -1) return null;
  const secret = sessionSecret();
  if (!secret) return null; // no stable secret → cannot verify → don't gate here (server still enforces)

  const [payloadB64, sigB64] = token.split(".");
  if (!payloadB64 || !sigB64) return null;

  try {
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"],
    );
    const ok = await crypto.subtle.verify("HMAC", key, b64urlToBytes(sigB64) as BufferSource, new TextEncoder().encode(payloadB64));
    if (!ok) return null;

    const payload = JSON.parse(new TextDecoder().decode(new Uint8Array(b64urlToBytes(payloadB64)))) as {
      kind?: string;
      assignments?: Array<{ mobileProfile?: string }>;
    };
    if (payload?.kind !== "temp") return null;

    const profiles = (payload.assignments ?? [])
      .map((a) => a?.mobileProfile)
      .filter((p): p is string => p === "mobile_cash_ledger" || p === "mobile_field");
    return (profiles[0] as EdgeMobileProfile) ?? "standard";
  } catch {
    return null;
  }
}

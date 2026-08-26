import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import type { EnterpriseRole } from "@/lib/permissions/enterprise-roles";
import { supportedLanguages, type SupportedLanguage } from "@/lib/i18n/languages";

export const ERP_SESSION_COOKIE = "erp_session";
const TEMP_USER_UUIDS: Record<string, string> = {
  "temp-super-admin": "00000000-0000-4000-8000-000000000001",
  "temp-pakistan-country-admin": "00000000-0000-4000-8000-000000000002",
  "temp-quetta-city-admin": "00000000-0000-4000-8000-000000000003"
};

type TempSessionPayloadV1 = {
  v: 1;
  kind: "temp";
  userId: string;
  email: string;
  fullName: string;
  roles: EnterpriseRole[];
  assignments?: Array<{
    role: EnterpriseRole;
    countryId: string | null;
    countryBranchId: string | null;
    cityBranchId: string | null;
    clearingAgentId?: string | null;
    ledgerVisibility?: string;
  }>;
  createdAt: number;
};

function base64UrlEncode(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function base64UrlDecode(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

let ephemeralSessionSecret: string | null = null;

function getSessionSecret() {
  const configured = process.env.ERP_SESSION_SECRET || process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  if (configured) return configured;

  if (!ephemeralSessionSecret) {
    ephemeralSessionSecret = randomBytes(32).toString("hex");
    console.warn(
      "[security] ERP_SESSION_SECRET is not set. Falling back to a random, process-local secret " +
        "(existing session cookies will be invalidated on every restart). Set ERP_SESSION_SECRET " +
        "in the environment for a stable, non-forgeable secret."
    );
  }
  return ephemeralSessionSecret;
}

function sign(payloadB64: string) {
  const mac = createHmac("sha256", getSessionSecret()).update(payloadB64).digest("base64url");
  return mac;
}

function normalizeLanguage(value: string | undefined): SupportedLanguage {
  if (!value) return "en";
  return supportedLanguages.some((l) => l.code === value) ? (value as SupportedLanguage) : "en";
}

export async function setTempSuperAdminSession(options: { remember: boolean }) {
  const cookieStore = await cookies();
  const payload: TempSessionPayloadV1 = {
    v: 1,
    kind: "temp",
    userId: TEMP_USER_UUIDS["temp-super-admin"],
    email: "superadmin@damaan.com",
    fullName: "Super Admin",
    roles: ["super_admin"],
    createdAt: Date.now()
  };

  const payloadB64 = base64UrlEncode(JSON.stringify(payload));
  const token = `${payloadB64}.${sign(payloadB64)}`;

  cookieStore.set(ERP_SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: options.remember ? 60 * 60 * 24 * 30 : 60 * 60 * 8
  });
}

export async function clearErpSession() {
  const cookieStore = await cookies();
  cookieStore.set(ERP_SESSION_COOKIE, "", { httpOnly: true, sameSite: "lax", path: "/", maxAge: 0 });
}

export async function readTempSession(): Promise<
  | {
      userId: string;
      email: string;
      fullName: string;
      roles: EnterpriseRole[];
      assignments: Array<{
        role: EnterpriseRole;
        countryId: string | null;
        countryBranchId: string | null;
        cityBranchId: string | null;
        clearingAgentId?: string | null;
        ledgerVisibility?: string;
      }>;
      preferredLanguage: SupportedLanguage;
    }
  | null
> {
  const cookieStore = await cookies();
  const token = cookieStore.get(ERP_SESSION_COOKIE)?.value;
  if (!token) return null;

  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [payloadB64, sig] = parts;
  if (!payloadB64 || !sig) return null;

  const expectedSig = sign(payloadB64);
  try {
    const a = Buffer.from(sig, "base64url");
    const b = Buffer.from(expectedSig, "base64url");
    if (a.length !== b.length) return null;
    if (!timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }

  let payload: TempSessionPayloadV1 | null = null;
  try {
    payload = JSON.parse(base64UrlDecode(payloadB64)) as TempSessionPayloadV1;
  } catch {
    return null;
  }

  if (!payload || payload.v !== 1 || payload.kind !== "temp") return null;

  const preferredLanguage = normalizeLanguage(cookieStore.get("erp_lang")?.value);

  return {
    userId: TEMP_USER_UUIDS[payload.userId] ?? payload.userId,
    email: payload.email,
    fullName: payload.fullName,
    roles: payload.roles,
    assignments: payload.assignments ?? [],
    preferredLanguage
  };
}

// Returns the raw signed token string without writing to cookies.
// Use this in Route Handlers that return NextResponse.redirect() — those must set cookies
// directly on the response object, not via the cookies() API.
export function buildTempAgentToken(options: {
  userId: string;
  email: string;
  fullName: string;
  roles: EnterpriseRole[];
  assignments: Array<{
    role: EnterpriseRole;
    countryId: string | null;
    countryBranchId: string | null;
    cityBranchId: string | null;
    clearingAgentId?: string | null;
    ledgerVisibility?: string;
  }>;
}): string {
  const payload: TempSessionPayloadV1 = {
    v: 1,
    kind: "temp",
    userId: options.userId,
    email: options.email,
    fullName: options.fullName,
    roles: options.roles,
    assignments: options.assignments,
    createdAt: Date.now()
  };
  const payloadB64 = base64UrlEncode(JSON.stringify(payload));
  return `${payloadB64}.${sign(payloadB64)}`;
}
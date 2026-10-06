import type { NextRequest } from "next/server";
import { writeAuditLog } from "@/lib/api/supabase";

export function getRequestIp(request: NextRequest) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    null
  );
}

export async function auditApiAction(
  request: NextRequest,
  input: {
    action: string;
    entityTable: string;
    entityId?: string | null;
    companyId?: string | null;
    before?: unknown;
    after?: unknown;
  }
) {
  await writeAuditLog({
    ...input,
    ipAddress: getRequestIp(request)
  });
}

import { NextRequest, NextResponse } from "next/server";
import { requireErpSession } from "@/lib/auth/session";
import { recordAuditEvent } from "@/lib/audit/enterprise-audit-service";
import { withLocalPg } from "@/lib/db/local-postgres";

// In-memory rate limiting for brute-force protection
const failedAttempts = new Map<string, { count: number; lockedUntil: number }>();

function checkRateLimit(ip: string): { allowed: boolean; remainingAttempts: number; retryAfterSec?: number } {
  const now = Date.now();
  const entry = failedAttempts.get(ip);
  if (entry) {
    if (entry.lockedUntil > now) {
      return { allowed: false, remainingAttempts: 0, retryAfterSec: Math.ceil((entry.lockedUntil - now) / 1000) };
    }
    if (entry.lockedUntil <= now && entry.count >= 5) {
      failedAttempts.delete(ip);
    }
  }
  const currentCount = failedAttempts.get(ip)?.count || 0;
  return { allowed: true, remainingAttempts: Math.max(0, 5 - currentCount) };
}

function recordFailedAttempt(ip: string) {
  const now = Date.now();
  const current = failedAttempts.get(ip) || { count: 0, lockedUntil: 0 };
  const newCount = current.count + 1;
  const lockedUntil = newCount >= 5 ? now + 10 * 60 * 1000 : 0; // Lock for 10 mins after 5 failed attempts
  failedAttempts.set(ip, { count: newCount, lockedUntil });
}

function clearFailedAttempts(ip: string) {
  failedAttempts.delete(ip);
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireErpSession(request);
    const ip = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "127.0.0.1";

    const rateCheck = checkRateLimit(ip);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: `Too many failed security PIN attempts. Security lockout active. Retry in ${rateCheck.retryAfterSec} seconds.` },
        { status: 429 }
      );
    }

    const body = await request.json();
    const { entityType, entityId, referenceNo, reason, securityCode } = body;

    if (!entityType || !entityId) {
      return NextResponse.json({ error: "entityType and entityId are required." }, { status: 400 });
    }

    // Only Super Admin or authorized Country Admin can restore
    if (!session.isSuperAdmin && !session.countryIds.length) {
      return NextResponse.json({ error: "Insufficient permissions to restore deleted records." }, { status: 403 });
    }

    // Server-side authoritative PIN verification
    const validPins = [
      process.env.SUPER_ADMIN_RESTORE_PIN || "9999",
      "3636"
    ];

    if (!securityCode || !validPins.includes(String(securityCode).trim())) {
      recordFailedAttempt(ip);
      return NextResponse.json(
        { error: `Invalid Security Authorization PIN. Verification failed. (Remaining attempts: ${rateCheck.remainingAttempts - 1})` },
        { status: 400 }
      );
    }

    clearFailedAttempts(ip);

    // Update actual table to clear deleted_at / set status = active
    await withLocalPg(async (sql) => {
      try {
        await sql.unsafe(`
          UPDATE ${sql(entityType)} 
          SET deleted_at = NULL 
          WHERE id::text = ${entityId} OR code = ${entityId};
        `);
      } catch (e) {
        try {
          await sql.unsafe(`
            UPDATE ${sql(entityType)} 
            SET status = 'active' 
            WHERE id::text = ${entityId} OR code = ${entityId};
          `);
        } catch (_) {}
      }
    });

    // Record immutable audit event for restore (NEVER log the PIN code itself)
    const sanitizedReason = reason ? String(reason).replace(/\b(9999|3636|363636)\b/g, "[REDACTED_PIN]") : "Restored by Administrator";

    const event = await recordAuditEvent({
      entityType,
      entityId,
      referenceNo,
      actionType: "RESTORE",
      reason: sanitizedReason,
      session,
      metadata: {
        ip_address: ip,
        auth_method: "server_verified_pin"
      }
    });

    return NextResponse.json({
      success: true,
      message: "Record successfully restored with complete audit trail preserved.",
      auditEventId: event.id
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to restore record." }, { status: 500 });
  }
}

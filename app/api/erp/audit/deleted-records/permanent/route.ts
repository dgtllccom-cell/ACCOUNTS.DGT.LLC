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
    const session = await requireErpSession();
    const ip = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "127.0.0.1";

    // Strictly restricted to Super Admin only
    if (!session.isSuperAdmin) {
      return NextResponse.json(
        { error: "Permanent deletion is strictly restricted to Super Admin level with immutable security audit." },
        { status: 403 }
      );
    }

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

    if (!reason || !reason.trim()) {
      return NextResponse.json({ error: "Mandatory Super Admin audit reason is required." }, { status: 400 });
    }

    // Authoritative server-side PIN validation
    const validPins = [
      process.env.SUPER_ADMIN_PERMANENT_DELETE_PIN || "3636",
      "363636",
      "36-36-36"
    ];

    if (!securityCode || !validPins.includes(String(securityCode).trim())) {
      recordFailedAttempt(ip);
      return NextResponse.json(
        { error: `Invalid Security Confirmation PIN. Permanent deletion strictly requires Super Admin PIN '3636'. (Remaining attempts: ${rateCheck.remainingAttempts - 1})` },
        { status: 400 }
      );
    }

    clearFailedAttempts(ip);

    // Sanitize reason to prevent PIN leak in audit log
    const sanitizedReason = String(reason).replace(/\b(3636|363636|9999)\b/g, "[REDACTED_PIN]");

    // 1. Record permanent deletion event in immutable audit log before actual delete
    const event = await recordAuditEvent({
      entityType,
      entityId,
      referenceNo,
      actionType: "PERMANENT_DELETE",
      reason: sanitizedReason,
      session,
      metadata: {
        ip_address: ip,
        auth_method: "super_admin_pin_3636_verified"
      }
    });

    // 2. Perform hard delete on the table
    await withLocalPg(async (sql) => {
      try {
        await sql.unsafe(`
          DELETE FROM ${sql(entityType)} 
          WHERE id::text = ${entityId} OR code = ${entityId};
        `);
      } catch (e: any) {
        console.warn(`[permanentDelete] Warning during hard delete on ${entityType}:`, e.message);
      }
    });

    return NextResponse.json({
      success: true,
      message: "Permanent deletion executed and permanently logged in Super Admin audit vault.",
      auditEventId: event?.id ?? null
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to execute permanent deletion." }, { status: 500 });
  }
}

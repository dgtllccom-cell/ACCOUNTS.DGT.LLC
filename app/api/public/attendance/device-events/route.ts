import { NextRequest } from "next/server";
import { z } from "zod";
import { apiOk, apiError, handleApiError } from "@/lib/api/response";
import { authenticateDevice, ingestPunches, toInstant } from "@/lib/services/hr-biometric-attendance-service";
import { checkRateLimit, sweepRateLimiter } from "@/lib/document-intelligence/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const bodySchema = z.object({
  punches: z
    .array(
      z.object({
        biometricId: z.union([z.string(), z.number()]).transform(String),
        time: z.string().min(10),
        direction: z.enum(["in", "out", "unknown"]).nullish(),
        verifyMode: z.string().max(40).nullish(),
      })
    )
    .min(1)
    .max(5000),
});

/**
 * Face-ID / biometric device push (no user session): headers `x-device-code` + `x-device-key`.
 * Punch time: ISO with offset, or device-local "YYYY-MM-DDTHH:MM:SS" (device timezone applied).
 * Stores raw punches idempotently and rolls them into the authoritative office_attendance.
 */
export async function POST(request: NextRequest) {
  try {
    const code = request.headers.get("x-device-code");
    const device = await authenticateDevice(code, request.headers.get("x-device-key"));
    sweepRateLimiter();
    const rl = checkRateLimit("process", `device:${device.id}`);
    if (!rl.ok) return apiError("RATE_LIMITED", `Too many pushes — retry in ${rl.retryAfterSec}s.`, 429);
    const body = bodySchema.parse(await request.json());
    const punches = body.punches.map((p) => ({ ...p, time: toInstant(p.time, device.timezone), raw: { ...p } }));
    return apiOk(await ingestPunches(device, punches, "device"));
  } catch (error) {
    return handleApiError(error);
  }
}

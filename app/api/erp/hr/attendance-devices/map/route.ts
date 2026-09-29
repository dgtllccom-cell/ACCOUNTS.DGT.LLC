import { NextRequest } from "next/server";
import { z } from "zod";
import { apiOk, handleApiError } from "@/lib/api/response";
import { guardHr } from "@/lib/services/hr-api";
import { mapBiometricId } from "@/lib/services/hr-biometric-attendance-service";

export const dynamic = "force-dynamic";
const bodySchema = z.object({ employeeId: z.string().uuid(), biometricId: z.string().trim().min(1).max(60) });

/** Assign a device biometric id to an employee; that id's unmatched punches are applied. */
export async function POST(request: NextRequest) {
  try {
    const { session } = await guardHr("write");
    const b = bodySchema.parse(await request.json());
    return apiOk(await mapBiometricId(session, b.employeeId, b.biometricId));
  } catch (error) {
    return handleApiError(error);
  }
}

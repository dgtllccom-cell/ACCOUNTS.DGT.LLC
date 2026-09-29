import { NextRequest } from "next/server";
import { z } from "zod";
import { apiOk, apiCreated, handleApiError } from "@/lib/api/response";
import { guardHr } from "@/lib/services/hr-api";
import { listDevices, registerDevice } from "@/lib/services/hr-biometric-attendance-service";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  deviceCode: z.string().trim().min(2).max(60),
  name: z.string().trim().min(2).max(120),
  deviceType: z.enum(["face", "fingerprint", "card", "mobile", "other"]).default("face"),
  serialNo: z.string().trim().max(80).nullish(),
  countryId: z.string().uuid(),
  countryBranchId: z.string().uuid().nullish(),
  cityBranchId: z.string().uuid().nullish(),
  timezone: z.string().trim().max(60).optional(),
});

export async function GET() {
  try {
    const { session } = await guardHr("read");
    return apiOk({ devices: await listDevices(session) });
  } catch (error) {
    return handleApiError(error);
  }
}

/** Register a device. The device key is returned ONCE — only its hash is stored. */
export async function POST(request: NextRequest) {
  try {
    const { session } = await guardHr("write");
    const body = createSchema.parse(await request.json());
    return apiCreated(await registerDevice(session, body));
  } catch (error) {
    return handleApiError(error);
  }
}

import type { NextRequest } from "next/server";
import { z } from "zod";
import { apiOk, handleApiError } from "@/lib/api/response";
import { guardContracts } from "@/lib/services/contract-register-api";
import { contractRegisterService } from "@/lib/services/contract-register-service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const bodySchema = z.object({ daysAhead: z.number().int().min(1).max(365).optional() });

export async function POST(request: NextRequest) {
  try {
    await guardContracts("write");
    const body = bodySchema.parse(await request.json().catch(() => ({})));
    // Smart CRM owns the reminders — this only asks it to (re)generate contract
    // reminders into crm_action_items; contract data stays in its source module.
    const { created } = await contractRegisterService.syncReminders(body.daysAhead ?? 30);
    return apiOk({ created });
  } catch (error) {
    return handleApiError(error);
  }
}

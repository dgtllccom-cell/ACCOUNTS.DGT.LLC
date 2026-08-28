import type { NextRequest } from "next/server";
import { z } from "zod";
import { apiOk, handleApiError } from "@/lib/api/response";
import { guardHr } from "@/lib/services/hr-api";
import { withLocalPg } from "@/lib/db/local-postgres";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const bodySchema = z.object({
  daysAhead: z.number().int().min(1).max(365).optional(),
  includeContracts: z.boolean().optional(),
});

/**
 * Ask Smart CRM (crm_action_items) to (re)generate HR reminders:
 * probation expiry, employee-document expiry, incomplete KYC, payroll approval
 * pending. Optionally also refresh contract reminders. CRM owns the reminders;
 * no employee/contract data is copied.
 */
export async function POST(request: NextRequest) {
  try {
    await guardHr("write");
    const body = bodySchema.parse(await request.json().catch(() => ({})));
    const days = body.daysAhead ?? 30;
    const result = await withLocalPg(async (sql) => {
      const hr = await sql`SELECT public.sync_hr_reminders(${days}) AS n`;
      let contracts = 0;
      if (body.includeContracts) {
        const c = await sql`SELECT public.sync_contract_reminders(${days}) AS n`;
        contracts = Number(c?.[0]?.n ?? 0);
      }
      return { hr: Number(hr?.[0]?.n ?? 0), contracts };
    });
    return apiOk(result);
  } catch (error) {
    return handleApiError(error);
  }
}

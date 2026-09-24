import type { NextRequest } from "next/server";
import { apiOk, handleApiError } from "@/lib/api/response";
import { requireErpSession } from "@/lib/auth/session";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import { getIntelligenceSummary } from "@/lib/ai-receptionist/call-intelligence";
import { getRequestLanguage } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/** Portfolio-level Conversation Intelligence summary: risk breakdown, Top Signals, Top Topics, repeated-contact list, agent performance. */
export async function GET(req: NextRequest) {
  try {
    const session = await requireErpSession();
    authorizeApiScope(session, { resource: "customers", action: "read" });
    const p = req.nextUrl.searchParams;
    await getRequestLanguage(p.get("lang")); // counts + short labels only — resolved for parity with other record routes
    const summary = await getIntelligenceSummary(session, {
      countryId: p.get("countryId") || undefined,
      cityBranchId: p.get("cityBranchId") || undefined,
      customerId: p.get("customerId") || undefined,
      assignedTo: p.get("assignedTo") || undefined,
      from: p.get("from") || undefined,
      to: p.get("to") || undefined,
      intent: p.get("intent") || undefined,
      riskLevel: p.get("riskLevel") || undefined,
    });
    return apiOk({ summary });
  } catch (error) {
    return handleApiError(error);
  }
}

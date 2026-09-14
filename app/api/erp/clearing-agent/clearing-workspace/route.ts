/* eslint-disable @typescript-eslint/no-explicit-any */
// Clearing & Customs Workspace (Phase 2, directive item #6) — legs across
// EXISTING Customer Orders that currently need clearing attention. Reads
// through the same clearing_customer_order_legs rows the order workflow
// screen uses; no separate clearing record, no new shipment identity.
export const dynamic = "force-dynamic";

import type { NextRequest } from "next/server";
import { apiOk, handleApiError } from "@/lib/api/response";
import { requireErpSession } from "@/lib/auth/session";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import { listClearingWorkspaceLegs } from "@/lib/services/clearing-order-workflow-service";
import { getRequestLanguage } from "@/lib/i18n/server";
import { localizeJoinedNames } from "@/lib/i18n/localize-records";

export async function GET(request: NextRequest) {
  try {
    const session = await requireErpSession();
    authorizeApiScope(session, { resource: "shipping_records", action: "read" });

    const { searchParams } = new URL(request.url);
    const customsCountryId = searchParams.get("countryId");
    const customsStatus = searchParams.get("status");

    const rows = (await listClearingWorkspaceLegs(session, { customsCountryId, customsStatus, limit: 100 })) || [];

    let legs: any[] = rows.map((r: any) => ({ ...r, id: r.id }));
    try {
      const lang = await getRequestLanguage(searchParams.get("lang"));
      legs = await localizeJoinedNames<any>(legs, lang, [
        { idField: "customs_country_id", nameField: "customs_country_name", table: "countries" },
      ]);
    } catch {
      // keep raw names if localization is unavailable
    }

    return apiOk({ legs });
  } catch (error) {
    return handleApiError(error);
  }
}

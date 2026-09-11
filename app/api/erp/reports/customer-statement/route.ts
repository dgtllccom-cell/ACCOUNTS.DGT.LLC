import { NextRequest, NextResponse } from "next/server";
import { requireErpSession } from "@/lib/auth/session";
import { authorize } from "@/lib/permissions/middleware";
import { rethrowIfNextControlFlow } from "@/lib/api/response";
import { withLocalPg } from "@/lib/db/local-postgres";
import { getCombinedCustomerStatement } from "@/lib/services/customer-statement-service";

/**
 * GET /api/erp/reports/customer-statement?customerId=&from=&to=
 * Combined Customer Statement — one query across every posted business AND
 * shipping transaction for a customer (see customer-statement-service.ts).
 */
export async function GET(req: NextRequest) {
  try {
    const session = await requireErpSession();
    authorize(session, { resource: "reports", action: "read" });

    const { searchParams } = new URL(req.url);
    const customerId = searchParams.get("customerId");
    if (!customerId) return NextResponse.json({ success: false, error: "customerId is required" }, { status: 400 });

    if (!session.isSuperAdmin) {
      const customer = await withLocalPg((sql) => sql`
        SELECT ea.country_id
        FROM public.enterprise_accounts ea
        WHERE ea.customer_id = ${customerId} AND ea.deleted_at IS NULL
        LIMIT 1
      `);
      const customerCountryId = customer?.[0]?.country_id;
      if (customerCountryId && !session.countryIds.includes(customerCountryId)) {
        return NextResponse.json({ success: false, error: "This customer is outside your authorized scope." }, { status: 403 });
      }
    }

    const report = await getCombinedCustomerStatement(customerId, {
      from: searchParams.get("from"),
      to: searchParams.get("to")
    });

    return NextResponse.json({ success: true, data: report });
  } catch (error: any) {
    rethrowIfNextControlFlow(error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

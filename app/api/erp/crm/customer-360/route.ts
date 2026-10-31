import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/api/response";
import { getCurrentErpSession, ErpAuthError } from "@/lib/auth/session";
import { ErpPermissionError, isStrictOperationalSession } from "@/lib/permissions/middleware";
import { 
  getCustomer360Data, 
  getCustomer360Profile, 
  logCustomer360Activity 
} from "@/lib/crm/customer-360-service";

import { customer360ActivitySchema, customer360QuerySchema } from "@/lib/crm/customer-360-validation";

// Existing CRM screens consume success; preserve the common ok contract too.
const customer360Ok = (data: unknown) => NextResponse.json({ ok: true, success: true, data });

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const session = await getCurrentErpSession();
    if (!session) throw new ErpAuthError();
    // amount-bearing CRM views: never for an operational login nor for a login whose financial field access is denied
    if (isStrictOperationalSession(session) || session.canViewFinancials === false) throw new ErpPermissionError("CRM financial views are outside your access.");
    const { searchParams } = request.nextUrl;

    const query = customer360QuerySchema.parse(Object.fromEntries(searchParams));
    const customerId = query.customerId;
    if (customerId) {
      // Return full 360 profile for a single customer
      const profile = await getCustomer360Profile({
        session,
        customerId
      });
      return customer360Ok(profile);
    }

    // Otherwise return Customer 360 register and KPIs
    const { countryId, branchId, assignedUser, search: searchQuery, startDate, endDate, status, page, pageSize } = query;

    const data = await getCustomer360Data({
      session,
      countryId,
      branchId,
      assignedUser,
      searchQuery,
      startDate,
      endDate,
      status,
      page,
      pageSize
    });

    return customer360Ok(data);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getCurrentErpSession();
    if (!session) throw new ErpAuthError();
    // amount-bearing CRM views: never for an operational login nor for a login whose financial field access is denied
    if (isStrictOperationalSession(session) || session.canViewFinancials === false) throw new ErpPermissionError("CRM financial views are outside your access.");
    const body = customer360ActivitySchema.parse(await request.json());

    const result = await logCustomer360Activity({ session, ...body });

    return customer360Ok(result);
  } catch (error) {
    return handleApiError(error);
  }
}

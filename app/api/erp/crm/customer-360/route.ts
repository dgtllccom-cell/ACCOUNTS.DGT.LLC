import { NextRequest } from "next/server";
import { apiError, apiOk, handleApiError } from "@/lib/api/response";
import { requireErpSession } from "@/lib/auth/session";
import { assertCrmRead, assertBusinessCrm } from "@/lib/crm/crm-access";
import { ErpPermissionError, isStrictOperationalSession } from "@/lib/permissions/middleware";
import { 
  getCustomer360Data, 
  getCustomer360Profile, 
  logCustomer360Activity 
} from "@/lib/crm/customer-360-service";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const session = await requireErpSession();
    assertCrmRead(session);
    assertBusinessCrm(session);
    // amount-bearing CRM views: never for an operational login nor for a login whose financial field access is denied
    if (isStrictOperationalSession(session) || session.canViewFinancials === false) throw new ErpPermissionError("CRM financial views are outside your access.");
    const { searchParams } = request.nextUrl;

    const customerId = searchParams.get("customerId");
    if (customerId) {
      // Return full 360 profile for a single customer
      try {
        const profile = await getCustomer360Profile({ session, customerId });
        return apiOk(profile);
      } catch (e) {
        // a customer that does not exist - or lies outside the login's scope - is a 404, never a server error
        if (e instanceof Error && /^Customer not found/i.test(e.message)) return apiError("NOT_FOUND", "Customer not found.", 404);
        throw e;
      }
    }

    // Otherwise return Customer 360 register and KPIs
    const countryId = searchParams.get("countryId");
    const branchId = searchParams.get("branchId");
    const assignedUser = searchParams.get("assignedUser");
    const searchQuery = searchParams.get("search");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const status = searchParams.get("status");
    const page = searchParams.get("page") ? parseInt(searchParams.get("page")!, 10) : 1;
    const pageSize = searchParams.get("pageSize") ? parseInt(searchParams.get("pageSize")!, 10) : 10;

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

    return apiOk(data);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireErpSession();
    assertCrmRead(session);
    assertBusinessCrm(session);
    // amount-bearing CRM views: never for an operational login nor for a login whose financial field access is denied
    if (isStrictOperationalSession(session) || session.canViewFinancials === false) throw new ErpPermissionError("CRM financial views are outside your access.");
    const body = await request.json();

    const {
      customerId,
      activityType,
      subject,
      notes,
      promiseDate,
      promiseAmount
    } = body;

    if (!customerId || !notes) {
      return handleApiError(new Error("Customer ID and notes are required."));
    }

    const result = await logCustomer360Activity({
      session,
      customerId,
      activityType: activityType || "Note",
      subject,
      notes,
      promiseDate,
      promiseAmount: promiseAmount ? Number(promiseAmount) : null
    });

    return apiOk(result);
  } catch (error) {
    return handleApiError(error);
  }
}

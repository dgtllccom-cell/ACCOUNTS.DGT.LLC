import { NextRequest } from "next/server";
import { apiOk, handleApiError } from "@/lib/api/response";
import { requireErpSession } from "@/lib/auth/session";
import { 
  getCustomer360Data, 
  getCustomer360Profile, 
  logCustomer360Activity 
} from "@/lib/crm/customer-360-service";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const session = await requireErpSession();
    const { searchParams } = request.nextUrl;

    const customerId = searchParams.get("customerId");
    if (customerId) {
      // Return full 360 profile for a single customer
      const profile = await getCustomer360Profile({
        session,
        customerId
      });
      return apiOk(profile);
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

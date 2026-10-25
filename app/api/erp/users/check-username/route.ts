import { NextRequest } from "next/server";
import { apiOk, handleApiError, ApiClientError } from "@/lib/api/response";
import { requireErpSession } from "@/lib/auth/session";
import { checkUsernameAvailable, suggestUsernames, findExistingLoginsForEmployee } from "@/lib/branch-network/duplicate-guard";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    await requireErpSession();
    const searchParams = request.nextUrl.searchParams;
    const username = (searchParams.get("username") || "").trim();
    const employeeId = searchParams.get("employeeId")?.trim() || null;
    const personMasterId = searchParams.get("personMasterId")?.trim() || null;
    const fullName = searchParams.get("fullName")?.trim() || undefined;
    const country = searchParams.get("country")?.trim() || undefined;
    const branch = searchParams.get("branch")?.trim() || undefined;
    const operationalDomain = searchParams.get("operationalDomain")?.trim() || undefined;

    let available = true;
    let suggestions: string[] = [];

    if (username) {
      available = await checkUsernameAvailable(username);
      if (!available) {
        suggestions = await suggestUsernames(username, {
          fullName,
          countryName: country,
          branchCode: branch,
          operationalDomain
        });
      }
    }

    let existingLogins: any[] = [];
    if (employeeId || personMasterId) {
      existingLogins = (await findExistingLoginsForEmployee({ employeeId, personMasterId })) || [];
    }

    return apiOk({
      username,
      available,
      suggestions,
      existingLogins
    });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireErpSession();
    const body = await request.json().catch(() => ({}));
    const username = String(body.username || "").trim();
    const employeeId = body.employeeId?.trim() || null;
    const personMasterId = body.personMasterId?.trim() || null;
    const fullName = body.fullName?.trim() || undefined;
    const country = body.country?.trim() || undefined;
    const branch = body.branch?.trim() || undefined;
    const operationalDomain = body.operationalDomain?.trim() || undefined;

    let available = true;
    let suggestions: string[] = [];

    if (username) {
      available = await checkUsernameAvailable(username);
      if (!available) {
        suggestions = await suggestUsernames(username, {
          fullName,
          countryName: country,
          branchCode: branch,
          operationalDomain
        });
      }
    }

    let existingLogins: any[] = [];
    if (employeeId || personMasterId) {
      existingLogins = (await findExistingLoginsForEmployee({ employeeId, personMasterId })) || [];
    }

    return apiOk({
      username,
      available,
      suggestions,
      existingLogins
    });
  } catch (err) {
    return handleApiError(err);
  }
}

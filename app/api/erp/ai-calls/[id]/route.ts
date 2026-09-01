import { NextRequest } from "next/server";
import { apiOk, handleApiError } from "@/lib/api/response";
import { requireErpSession } from "@/lib/auth/session";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import { getCall } from "@/lib/ai-receptionist/service";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireErpSession();
    authorizeApiScope(session, { resource: "customers", action: "read" });
    const { id } = await params;
    const result = await getCall(session, id);
    return apiOk(result);
  } catch (error) {
    return handleApiError(error);
  }
}

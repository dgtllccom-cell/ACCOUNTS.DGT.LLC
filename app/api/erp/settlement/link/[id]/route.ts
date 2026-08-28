import { NextRequest } from "next/server";
import { apiOk, handleApiError } from "@/lib/api/response";
import { requireErpSession } from "@/lib/auth/session";
import { settlementService } from "@/lib/services/settlement-service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireErpSession();
    const { id: linkId } = await context.params;
    const { searchParams } = new URL(request.url);
    const reason = searchParams.get("reason") || undefined;

    if (!linkId) {
      return handleApiError(new Error("Link ID is required"));
    }

    await settlementService.removeLink({
      linkId,
      actorId: session.userId,
      reason
    });

    return apiOk({ success: true, message: "Settlement link removed" });
  } catch (error) {
    return handleApiError(error);
  }
}

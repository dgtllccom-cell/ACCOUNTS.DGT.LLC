import { NextRequest, NextResponse } from "next/server";
import { requireErpSession } from "@/lib/auth/session";
import { withLocalPg } from "@/lib/db/local-postgres";
import { rethrowIfNextControlFlow } from "@/lib/api/response";
import { assertShippingUserExplicitPermission } from "@/lib/permissions/shipping-explicit-gate";
import { t } from "@/lib/i18n/ui";
import { assertCrmItemInScope } from "@/lib/crm/smart-crm-service";

export async function POST(request: NextRequest) {
  try {
    const session = await requireErpSession();
    assertShippingUserExplicitPermission(session, "crm", "followup");
    const body = await request.json();
    const { crmItemId, remarks } = body;

    if (!crmItemId) {
      return NextResponse.json({ error: "crmItemId is required." }, { status: 400 });
    }
    await assertCrmItemInScope(session, crmItemId);

    const result = await withLocalPg(async (sql) => {
      await sql`
        UPDATE crm_action_items
        SET 
          is_completed = true,
          status = 'Completed',
          urgency_class = 'completed',
          completed_at = NOW(),
          completed_by = ${session.fullName || session.userId},
          notes = COALESCE(${remarks}, notes),
          updated_at = NOW()
        WHERE id = ${crmItemId};
      `;

      return { success: true };
    });

    return NextResponse.json({
      success: true,
      message: t(session.preferredLanguage, "crm.item_completed", "Action item successfully marked as completed.")
    });
  } catch (error: any) {
    rethrowIfNextControlFlow(error);
    return NextResponse.json({ error: error.message || "Failed to complete item." }, { status: error?.status || 500 });
  }
}

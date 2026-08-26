import { NextRequest, NextResponse } from "next/server";
import { requireErpSession } from "@/lib/auth/session";
import { withLocalPg } from "@/lib/db/local-postgres";

export async function POST(request: NextRequest) {
  try {
    const session = await requireErpSession(request);
    const body = await request.json();
    const { crmItemId, noteType, noteText, promiseDate, promiseAmount, nextFollowUp } = body;

    if (!crmItemId || !noteText) {
      return NextResponse.json({ error: "crmItemId and noteText are required." }, { status: 400 });
    }

    const result = await withLocalPg(async (sql) => {
      // 1. Insert note into crm_followup_notes
      await sql`
        INSERT INTO crm_followup_notes (
          crm_item_id,
          user_id,
          user_name,
          user_role,
          note_type,
          note_text,
          promise_date,
          promise_amount
        ) VALUES (
          ${crmItemId},
          ${session.userId},
          ${session.fullName || "User"},
          ${session.roles?.[0] || "Admin"},
          ${noteType || "Call Follow-Up"},
          ${noteText},
          ${promiseDate ? promiseDate : null},
          ${promiseAmount ? promiseAmount : null}
        );
      `;

      // 2. Update crm_action_items last_follow_up and next_follow_up
      await sql`
        UPDATE crm_action_items
        SET 
          last_follow_up = NOW(),
          next_follow_up = ${nextFollowUp ? nextFollowUp : null},
          notes = ${noteText},
          updated_at = NOW()
        WHERE id = ${crmItemId};
      `;

      return { success: true };
    });

    return NextResponse.json({
      success: true,
      message: "Follow-up note successfully recorded."
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to record follow-up." }, { status: 500 });
  }
}

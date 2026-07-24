import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const admin = createSupabaseAdminClient() as any;

    // The user wants to keep the main "Super Admin" and remove Najeeb and Asmatullah.
    // The super admin we KEEP: "7719341b-bfcb-4a31-b852-0f67e8062e95" (Super Admin)
    
    // The ones we remove (soft delete):
    // 5215b743-fefd-423e-b032-15b564e5d939 (najeeb)
    // 13a5efb0-70d3-4020-a07c-9bbc1c01ce6c (asmatullah)
    // 80871d49-ca14-4802-aaaa-2200d63fe6fa (NAJEEB)

    const idsToRemove = [
      "5215b743-fefd-423e-b032-15b564e5d939",
      "13a5efb0-70d3-4020-a07c-9bbc1c01ce6c",
      "80871d49-ca14-4802-aaaa-2200d63fe6fa"
    ];

    const now = new Date().toISOString();

    const { data: updateData, error: updateErr } = await admin
      .from("profiles")
      .update({ deleted_at: now })
      .in("id", idsToRemove)
      .select("id, full_name, deleted_at");

    if (updateErr) {
      return NextResponse.json({ error: updateErr });
    }

    // Ensure the main super admin has the role assignment!
    const superAdminId = "7719341b-bfcb-4a31-b852-0f67e8062e95";
    const { data: existingAssignment } = await admin
      .from("user_role_assignments")
      .select("id")
      .eq("user_id", superAdminId)
      .eq("role", "super_admin");

    let assignmentMsg = "Already has assignment";
    if (!existingAssignment || existingAssignment.length === 0) {
      const { error: insertErr } = await admin.from("user_role_assignments").insert({
        user_id: superAdminId,
        role: "super_admin",
        is_active: true
      });
      if (insertErr) {
        assignmentMsg = `Failed to insert assignment: ${insertErr.message}`;
      } else {
        assignmentMsg = "Inserted assignment";
      }
    }

    return NextResponse.json({ 
      message: "Successfully removed extra super admins.", 
      removed: updateData,
      superAdminAssignment: assignmentMsg
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message });
  }
}

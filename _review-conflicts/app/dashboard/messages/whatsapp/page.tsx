import { requireErpSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { WhatsAppInbox } from "@/features/whatsapp/components/whatsapp-inbox";

export const metadata = {
  title: "WhatsApp Inbox — DGT ERP",
  description: "Team WhatsApp inbox — manage customer conversations scoped to your country and branch"
};

/**
 * Full-width WhatsApp Team Inbox page.
 * Bypasses the standard page padding so the 3-panel layout fills the viewport.
 */
export default async function WhatsAppInboxPage() {
  const session = await requireErpSession();

  // Minimum permission check — must have whatsapp:read (or be a super admin)
  if (!session.isSuperAdmin && !session.permissions.includes("whatsapp:read")) {
    redirect("/dashboard");
  }

  return (
    // -m-4 md:-m-6 cancels the standard page padding so the inbox fills the full width
    <div className="-mx-4 -my-4 md:-mx-6 md:-my-6">
      <WhatsAppInbox session={session} />
    </div>
  );
}

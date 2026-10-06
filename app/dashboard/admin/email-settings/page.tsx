import { requireErpSession } from "@/lib/auth/session";
import { EmailSettingsView } from "@/features/email/components/email-settings-view";
import { redirect } from "next/navigation";

export const metadata = {
  title: "Email Account Settings",
  description: "Manage email credentials and test connections"
};

export default async function EmailSettingsPage() {
  const session = await requireErpSession();

  // Only super admin can access email settings
  if (!session.isSuperAdmin) {
    redirect("/dashboard");
  }

  return (
    <div className="p-6">
      <EmailSettingsView />
    </div>
  );
}

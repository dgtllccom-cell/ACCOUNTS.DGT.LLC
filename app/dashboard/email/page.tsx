import { requireErpSession } from "@/lib/auth/session";
import { EmailWorkspace } from "@/features/email/components/email-workspace";

export const metadata = {
  title: "Email - DGT ERP",
};

export const dynamic = "force-dynamic";

export default async function EmailDashboardPage() {
  const session = await requireErpSession();
  return <EmailWorkspace session={session} />;
}

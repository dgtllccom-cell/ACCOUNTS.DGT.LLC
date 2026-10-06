import { requireErpSession } from "@/lib/auth/session";
import { CommunicationCenterDashboard } from "@/features/communication-center/components/communication-center-dashboard";

export const metadata = {
  title: "Communication Center - DAMAAN ERP",
  description: "Central email, WhatsApp, CRM, follow-up, campaign and communication reporting module."
};

export default async function CommunicationCenterPage() {
  const session = await requireErpSession();
  return <CommunicationCenterDashboard session={session} />;
}

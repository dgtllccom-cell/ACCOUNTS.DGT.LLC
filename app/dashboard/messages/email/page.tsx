import { requireErpSession } from "@/lib/auth/session";
import { EmailMessagesView } from "@/features/email/components/email-messages-view";

export const metadata = {
  title: "Email Messages",
};

export default async function EmailPage() {
  await requireErpSession();
  return <EmailMessagesView />;
}

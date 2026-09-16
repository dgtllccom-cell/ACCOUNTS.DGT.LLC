import { requireErpSession } from "@/lib/auth/session";
import { EmailWorkspace } from "@/features/email/components/email-workspace";

export const metadata = {
  title: "Email",
};

export const dynamic = "force-dynamic";

export default async function EmailPage() {
  await requireErpSession();
  return <EmailWorkspace />;
}

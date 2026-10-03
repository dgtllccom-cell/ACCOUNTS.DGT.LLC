import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentErpSession } from "@/lib/auth/session";
import { UserCredentialsPdfView } from "@/features/users/components/user-credentials-pdf-view";

export const metadata: Metadata = {
  title: "User Credentials & Passwords PDF | Super Admin",
  description: "Confidential Super Admin download page for verified ERP user accounts and live monitoring PDF."
};

export default async function UserCredentialsPdfPage() {
  const session = await getCurrentErpSession();

  // STRICT ACCESS CONTROL: Super Admin ONLY
  if (!session || !session.isSuperAdmin) {
    redirect("/dashboard");
  }

  return <UserCredentialsPdfView />;
}

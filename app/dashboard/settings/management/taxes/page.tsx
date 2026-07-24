import { requireErpSession } from "@/lib/auth/session";
import TaxesManagementClient from "./ui-client";

export default async function TaxesManagementPage() {
  const session = await requireErpSession();
  return <TaxesManagementClient session={session} />;
}

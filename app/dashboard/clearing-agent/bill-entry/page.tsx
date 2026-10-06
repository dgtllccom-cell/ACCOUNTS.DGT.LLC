import { BlRecordsRegister } from "@/features/shipping/components/bl-records-register";
import { requireErpSession } from "@/lib/auth/session";

export const metadata = { title: "Clearing Agent — Bill Entry" };


export default async function ClearingBillEntryPage() {
  const session = await requireErpSession();
  return <BlRecordsRegister context="shipping" lang={session?.preferredLanguage ?? "en"} />;
}

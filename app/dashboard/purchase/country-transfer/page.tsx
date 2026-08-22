import { CountryTransferRegisterView } from "@/features/purchases/components/country-transfer-register-view";
import { requireErpSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function CountryTransferPage() {
  await requireErpSession();
  return <CountryTransferRegisterView />;
}

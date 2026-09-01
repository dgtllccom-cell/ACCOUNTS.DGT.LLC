import { requireErpSession } from "@/lib/auth/session";
import ProductMasterClient from "./ui-client";

export const metadata = { title: "CHS Product & Stock Master — Digital Dock ERP" };

export default async function ChsProductsPage() {
  const session = await requireErpSession();
  return (
    <div className="w-full px-3 sm:px-6 lg:px-8 py-4">
      <ProductMasterClient session={{ preferredLanguage: session.preferredLanguage ?? "en" }} />
    </div>
  );
}

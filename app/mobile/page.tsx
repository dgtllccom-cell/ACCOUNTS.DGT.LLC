import { Metadata } from "next";
import { requireErpSession } from "@/lib/auth/session";
import { MobileAppContainer } from "@/features/mobile/components/mobile-app-container";

export const metadata: Metadata = {
  title: "AI Mobile – Return WhatsApp Reply",
  description: "Dedicated mobile AI application for iPhone and Android connected to Digital Dock ERP."
};

export default async function MobileAppPage() {
  const session = await requireErpSession();
  const lang = session.preferredLanguage ?? "en";

  return <MobileAppContainer lang={lang} />;
}

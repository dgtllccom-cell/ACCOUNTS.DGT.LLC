import type { Metadata } from "next";
import { requireErpSession } from "@/lib/auth/session";
import { AiCallsRegisterView } from "@/features/ai-receptionist/components/ai-calls-register-view";

export const metadata: Metadata = { title: "AI Receptionist Calls — Digital Dock ERP" };

export default async function AiCallsPage() {
  const session = await requireErpSession();
  const lang = session.preferredLanguage ?? "en";
  return (
    <div className="w-full px-3 sm:px-6 lg:px-8 py-4">
      <AiCallsRegisterView lang={lang} />
    </div>
  );
}

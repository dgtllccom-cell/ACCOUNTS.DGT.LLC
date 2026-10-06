import type { Metadata } from "next";
import { requireErpSession } from "@/lib/auth/session";
import { ConversationIntelligenceView } from "@/features/customer-inquiry/components/conversation-intelligence-view";

export const metadata: Metadata = { title: "Meeting & Conversation Intelligence — Digital Dock ERP" };
export const dynamic = "force-dynamic";

export default async function ConversationIntelligencePage() {
  const session = await requireErpSession();
  return (
    <div className="w-full px-3 py-4 sm:px-6 lg:px-8">
      <ConversationIntelligenceView lang={session.preferredLanguage ?? "en"} />
    </div>
  );
}

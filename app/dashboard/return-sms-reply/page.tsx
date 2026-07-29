import { Metadata } from "next";
import { requireErpSession } from "@/lib/auth/session";
import { resolveReportScope } from "@/lib/permissions/middleware";
import { ReturnSmsReplyContainer } from "@/features/return-sms-reply/components/return-sms-reply-container";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Return SMS Reply — AI Communication Centre",
  description: "Centralized WhatsApp & Email AI communication center for multi-country, automated business replies and payment reminders."
};

export default async function ReturnSmsReplyPage() {
  const session = await requireErpSession();
  const scope = resolveReportScope(session);
  const lang = session.preferredLanguage ?? "en";

  return (
    <div className="min-h-screen bg-slate-50/50 dark:bg-slate-950/50 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-screen-2xl">
        <ReturnSmsReplyContainer lang={lang} scopeLevel={scope.level} />
      </div>
    </div>
  );
}

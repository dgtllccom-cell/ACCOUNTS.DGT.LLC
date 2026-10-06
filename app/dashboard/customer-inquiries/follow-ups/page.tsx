import type { Metadata } from "next";
import { requireErpSession } from "@/lib/auth/session";
import { InquiryRegisterView } from "@/features/customer-inquiry/components/inquiry-register-view";

export const metadata: Metadata = {
  title: "Inquiry Follow-ups — Digital Dock ERP",
};

export default async function InquiryFollowUpsPage() {
  const session = await requireErpSession();
  const lang = session.preferredLanguage ?? "en";
  return (
    <div className="w-full px-3 sm:px-6 lg:px-8 py-4">
      <InquiryRegisterView scope="follow_up" lang={lang} />
    </div>
  );
}

import type { Metadata } from "next";
import { requireErpSession } from "@/lib/auth/session";
import { InquiryRegisterView } from "@/features/customer-inquiry/components/inquiry-register-view";

export const metadata: Metadata = {
  title: "Customer Inquiries — Digital Dock ERP",
  description: "Online customer inquiry & meeting record register with AI voice/text entry.",
};

export default async function CustomerInquiriesPage() {
  const session = await requireErpSession();
  const lang = session.preferredLanguage ?? "en";
  return (
    <div className="w-full px-3 sm:px-6 lg:px-8 py-4">
      <InquiryRegisterView scope="all" lang={lang} />
    </div>
  );
}

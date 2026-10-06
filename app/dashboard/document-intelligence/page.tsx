import { requireErpSession } from "@/lib/auth/session";
import { DocumentIntakeCenter } from "@/features/document-intelligence/components/document-intake-center";

export const dynamic = "force-dynamic";

export const metadata = { title: "AI Document Intake — ERP" };

export default async function DocumentIntelligencePage() {
  const session = await requireErpSession();
  const lang = session.preferredLanguage ?? "en";
  return <DocumentIntakeCenter lang={lang} />;
}

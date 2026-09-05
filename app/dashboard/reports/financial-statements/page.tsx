import { FinancialStatementsView } from "@/features/reports/components/financial-statements-view";
import { getRequestLanguage } from "@/lib/i18n/server";

export const metadata = { title: "Reports — Financial Statements" };
export const dynamic = "force-dynamic";

export default async function FinancialStatementsPage() {
  const lang = await getRequestLanguage();
  return (
    <div className="container mx-auto p-4 md:p-6">
      <FinancialStatementsView lang={lang} />
    </div>
  );
}

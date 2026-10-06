import { BankForm } from "@/features/banks/components/bank-form";
import { EntryMethodSelector } from "@/features/document-intelligence/components/entry-method-selector";
import { getCurrentErpSession } from "@/lib/auth/session";

export default async function NewBankPage() {
  const session = await getCurrentErpSession();
  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      <EntryMethodSelector targetModule="banks" domain="business" lang={session?.preferredLanguage ?? "en"}>
        <BankForm />
      </EntryMethodSelector>
    </div>
  );
}

export function generateMetadata() {
  return {
    title: "New Bank | Bank Setup",
    description: "Create and register a new enterprise bank account",
  };
}

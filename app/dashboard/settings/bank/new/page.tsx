import { BankForm } from "@/features/banks/components/bank-form";

export default function NewBankPage() {
  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      <BankForm />
    </div>
  );
}

export function generateMetadata() {
  return {
    title: "New Bank | Bank Setup",
    description: "Create and register a new enterprise bank account",
  };
}

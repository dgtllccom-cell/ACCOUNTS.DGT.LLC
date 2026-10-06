import { BankForm } from "@/features/banks/components/bank-form";

export default async function EditBankPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      <BankForm initialBankId={id} />
    </div>
  );
}

export function generateMetadata() {
  return {
    title: "Edit Bank | Bank Setup",
    description: "View and update an existing enterprise bank account",
  };
}

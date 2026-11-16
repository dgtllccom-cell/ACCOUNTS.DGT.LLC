import { AccountCategoriesSettings } from "@/features/accounts/components/account-categories-settings";

export const metadata = { title: "Settings — Account Categories" };


export default function AccountCategoriesPage() {
  return (
    <div className="p-6">
      <AccountCategoriesSettings />
    </div>
  );
}

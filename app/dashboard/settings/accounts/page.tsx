import { AccountRegistry } from "@/features/accounts/components/account-registry";

export const metadata = { title: "Settings — Accounts" };


export default function AccountsPage() {
  return (
    <div className="p-6">
      <AccountRegistry />
    </div>
  );
}

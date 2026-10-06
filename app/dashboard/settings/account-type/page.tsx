import { AccountTypeRegistry } from "@/features/account-types/components/account-type-registry";

export const metadata = { title: "Settings — Account Type" };


export default function AccountTypePage() {
  return (
    <div className="p-6">
      <AccountTypeRegistry />
    </div>
  );
}

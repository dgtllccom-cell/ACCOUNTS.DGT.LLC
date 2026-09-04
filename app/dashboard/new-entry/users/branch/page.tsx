import { UserEntryForm } from "@/features/users/components/user-entry-form";
import { NewEntryUserHeader } from "@/features/users/components/new-entry-user-header";

export const metadata = { title: "New Entry — Users — Branch" };


export default function BranchUserEntryPage() {
  return (
    <div className="space-y-6">
      <NewEntryUserHeader
        titleKey="neu.title_branch"
        titleFallback="Branch User"
        descKey="neu.desc_branch"
        descFallback="Create users scoped to a city branch (City Branch Admin / Accountant / Cashier / Staff / Auditor)."
      />

      <UserEntryForm kind="branch" />
    </div>
  );
}

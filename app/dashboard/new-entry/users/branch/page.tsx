import { UserEntryForm } from "@/features/users/components/user-entry-form";

export default function BranchUserEntryPage() {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary">New Entry</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Branch User</h1>
        <p className="text-sm text-muted-foreground">
          Create users scoped to a city branch (City Branch Admin / Accountant / Cashier / Staff / Auditor).
        </p>
      </div>

      <UserEntryForm kind="branch" />
    </div>
  );
}


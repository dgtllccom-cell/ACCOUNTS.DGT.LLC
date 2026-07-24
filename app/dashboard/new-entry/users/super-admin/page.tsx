import { UserEntryForm } from "@/features/users/components/user-entry-form";

export default function SuperAdminUserEntryPage() {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary">New Entry</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Super Admin User</h1>
        <p className="text-sm text-muted-foreground">Create global administrators with full platform access.</p>
      </div>

      <UserEntryForm kind="super_admin" />
    </div>
  );
}


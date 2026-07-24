import { UserEntryForm } from "@/features/users/components/user-entry-form";

export default function StaffUserEntryPage() {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary">New Entry</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Staff User</h1>
        <p className="text-sm text-muted-foreground">
          Create staff users with limited access, aligned to branch scope and assigned tasks.
        </p>
      </div>

      <UserEntryForm kind="staff" />
    </div>
  );
}


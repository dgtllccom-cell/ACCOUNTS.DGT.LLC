import { UserEntryForm } from "@/features/users/components/user-entry-form";
import { NewEntryUserHeader } from "@/features/users/components/new-entry-user-header";

export const metadata = { title: "New Entry — Users — Super Admin" };


export default function SuperAdminUserEntryPage() {
  return (
    <div className="space-y-6">
      <NewEntryUserHeader
        titleKey="neu.title_super_admin"
        titleFallback="Super Admin User"
        descKey="neu.desc_super_admin"
        descFallback="Create global administrators with full platform access."
      />

      <UserEntryForm kind="super_admin" />
    </div>
  );
}

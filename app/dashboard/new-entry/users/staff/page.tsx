import { UserEntryForm } from "@/features/users/components/user-entry-form";
import { NewEntryUserHeader } from "@/features/users/components/new-entry-user-header";

export const metadata = { title: "New Entry — Users — Staff" };


export default function StaffUserEntryPage() {
  return (
    <div className="space-y-6">
      <NewEntryUserHeader
        titleKey="neu.title_staff"
        titleFallback="Staff User"
        descKey="neu.desc_staff"
        descFallback="Create staff users with limited access, aligned to branch scope and assigned tasks."
      />

      <UserEntryForm kind="staff" />
    </div>
  );
}

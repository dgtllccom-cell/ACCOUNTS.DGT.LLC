import { UserEntryForm } from "@/features/users/components/user-entry-form";
import { NewEntryUserHeader } from "@/features/users/components/new-entry-user-header";

export const metadata = { title: "New Entry — Users — Country" };


export default function CountryUserEntryPage() {
  return (
    <div className="space-y-6">
      <NewEntryUserHeader
        titleKey="neu.title_country"
        titleFallback="Country User"
        descKey="neu.desc_country"
        descFallback="Create users scoped to a single country (Country Admin / Main Branch Admin / Auditor)."
      />

      <UserEntryForm kind="country" />
    </div>
  );
}

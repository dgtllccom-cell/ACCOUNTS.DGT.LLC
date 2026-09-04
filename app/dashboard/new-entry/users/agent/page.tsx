import { UserEntryForm } from "@/features/users/components/user-entry-form";
import { NewEntryUserHeader } from "@/features/users/components/new-entry-user-header";

export const metadata = { title: "New Entry — Users — Agent" };


export default function AgentUserEntryPage() {
  return (
    <div className="space-y-6">
      <NewEntryUserHeader
        titleKey="neu.title_agent"
        titleFallback="Agent User"
        descKey="neu.desc_agent"
        descFallback="Create agent users for shipping, clearing, trading, and customer workflows."
      />

      <UserEntryForm kind="agent" />
    </div>
  );
}

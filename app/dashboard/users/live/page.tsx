import { Suspense } from "react";
import { LiveUsersMonitoringView } from "@/features/users/components/live-users-monitoring-view";

export const metadata = {
  title: ["Live", "Users"].join(" ")
};

export default function LiveUsersPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-xs text-slate-400">Loading...</div>}>
      <LiveUsersMonitoringView />
    </Suspense>
  );
}

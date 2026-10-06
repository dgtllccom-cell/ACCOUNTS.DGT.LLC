import { Suspense } from "react";
import { Metadata } from "next";
import { SmartCrmWorkspace } from "@/features/crm/components/smart-crm-workspace";

const nt = (s: string) => s;

export const metadata: Metadata = {
  title: nt("CRM Reports — Customer 360"),
  description: nt("Enterprise CRM Reports, Customer 360, and Commercial Control Center")
};

export default function SmartCrmPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-400">Loading CRM Workspace...</div>}>
      <SmartCrmWorkspace />
    </Suspense>
  );
}

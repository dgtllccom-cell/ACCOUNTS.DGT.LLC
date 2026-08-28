import { Metadata } from "next";
import { SmartCrmControlCenter } from "@/features/crm/components/smart-crm-control-center";

export const metadata: Metadata = {
  title: "Smart CRM / Due & Follow-Up Control Center",
  description: "Enterprise Smart CRM, Due Date Engine, and Follow-Up Action Control Center"
};

export default function SmartDuePage() {
  return <SmartCrmControlCenter />;
}

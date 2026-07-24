import { requireErpSession } from "@/lib/auth/session";
import { PortMasterClient } from "@/features/ports/components/port-master-client";

export default async function PortMasterPage() {
  await requireErpSession();

  return (
    <PortMasterClient
      type="loading"
      title="Port / Boundary Master"
      description="Manage departure and arrival ports, border checkpoints, and airports for shipments."
      apiEndpoint="/api/erp/ports/loading"
    />
  );
}

export const metadata = { title: "Settings — Ports" };

﻿import { PortRegistry } from "@/features/ports/components/port-registry";

export default function PortsPage() {
  return (
    <div className="p-6">
      <PortRegistry />
    </div>
  );
}

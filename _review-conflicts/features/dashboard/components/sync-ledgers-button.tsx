"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export function SyncLedgersButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [loading, setLoading] = useState(false);

  const handleSync = async () => {
    setLoading(true);
    // Simulate a short syncing transition/revalidation period
    await new Promise((resolve) => setTimeout(resolve, 800));
    
    startTransition(() => {
      router.refresh();
      setLoading(false);
    });
  };

  const isSyncing = loading || isPending;

  return (
    <Button
      size="sm"
      variant="default"
      className="shadow-md shadow-primary/10"
      onClick={handleSync}
      disabled={isSyncing}
    >
      <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${isSyncing ? "animate-spin" : ""}`} />
      {isSyncing ? "Syncing..." : "Sync Ledgers"}
    </Button>
  );
}

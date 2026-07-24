import React from "react";
import { GoodsMasterPageClient } from "@/features/goods/components/goods-master-page-client";
import { getCurrentErpSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { PackageOpen } from "lucide-react";

export default async function GoodsMasterPage() {
  const session = await getCurrentErpSession();
  if (!session) redirect("/auth/login");

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary">Master Data</p>
        <h1 className="mt-1 flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <PackageOpen className="h-6 w-6 text-primary" />
          Goods Master & Variations
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage root Goods entries (Name, HS Code) and their associated Variations (Origin, Size, Brand).
        </p>
      </div>

      <div className="rounded-lg border bg-card overflow-hidden">
        <GoodsMasterPageClient />
      </div>
    </div>
  );
}

import React from "react";
import { GoodsMasterPageClient } from "@/features/goods/components/goods-master-page-client";
import { getCurrentErpSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { PackageOpen } from "lucide-react";
import { DashboardPageHeader } from "@/components/layout/dashboard-page-header";

export const metadata = { title: "New Entry — Goods Master" };


export default async function GoodsMasterPage() {
  const session = await getCurrentErpSession();
  if (!session) redirect("/auth/login");

  return (
    <div className="space-y-6">
      <DashboardPageHeader
        eyebrowKey="dph.master_data"
        eyebrowFallback="Master Data"
        titleKey="dph.goods_master_title"
        titleFallback="Goods Master & Variations"
        descKey="dph.goods_master_desc"
        descFallback="Manage root Goods entries (Name, HS Code) and their associated Variations (Origin, Size, Brand)."
        icon={<PackageOpen className="h-6 w-6 text-primary" />}
      />

      <div className="rounded-lg border bg-card overflow-hidden">
        <GoodsMasterPageClient />
      </div>
    </div>
  );
}

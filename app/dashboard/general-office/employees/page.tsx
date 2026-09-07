"use client";

import React, { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { VipRegisterEmployeeView } from "@/features/general-office/components/vip-register-employee-view";
import { ShareFormsTab } from "@/features/general-office/components/share-forms-tab";
import { GeneralOfficeLoadingSkeleton } from "@/features/general-office/components/general-office-skeleton";

function GeneralOfficeEmployeeContent() {
  const searchParams = useSearchParams();
  const tab = searchParams.get("tab");

  if (tab === "share-forms") {
    return (
      <div className="space-y-6">
        <ShareFormsTab />
      </div>
    );
  }

  return <VipRegisterEmployeeView />;
}

export default function GeneralOfficeEmployeePage() {
  return (
    <div className="w-full px-4 sm:px-6 lg:px-8 py-6">
      <Suspense fallback={<GeneralOfficeLoadingSkeleton />}>
        <GeneralOfficeEmployeeContent />
      </Suspense>
    </div>
  );
}

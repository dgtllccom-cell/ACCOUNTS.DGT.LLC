import React from "react";

import { cn } from "@/lib/utils";

export function ReportTh({ children, className }: { children: React.ReactNode; className?: string }) {
  return <th className={cn("px-2 py-2 text-center text-[11px] font-semibold", className)}>{children}</th>;
}

export function ReportTd({ children, className }: { children: React.ReactNode; className?: string }) {
  return <td className={cn("px-2 py-2 align-top", className)}>{children}</td>;
}

export function ReportKV({
  k,
  v,
  tone
}: {
  k: string;
  v: string;
  tone?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-[11px] font-medium text-muted-foreground">{k}</span>
      <span className={cn("text-right font-semibold", tone)}>{v}</span>
    </div>
  );
}


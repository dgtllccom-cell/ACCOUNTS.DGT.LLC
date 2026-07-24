import React from "react";

import { cn } from "@/lib/utils";

export function ReportPageHeader({
  title,
  subtitle,
  actions,
  className
}: {
  title: string;
  subtitle?: string | null;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between", className)}>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {subtitle ? <p className="text-sm text-muted-foreground">{subtitle}</p> : null}
      </div>

      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </section>
  );
}


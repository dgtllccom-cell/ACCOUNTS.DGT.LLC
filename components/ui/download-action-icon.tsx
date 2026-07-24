"use client";

import { Paperclip } from "lucide-react";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export function DownloadActionIcon({ className, ...props }: ComponentProps<typeof Paperclip>) {
  return (
    <Paperclip
      className={cn("h-4 w-4 text-slate-700 dark:text-slate-200", className)}
      aria-hidden
      strokeWidth={2.25}
      {...props}
    />
  );
}

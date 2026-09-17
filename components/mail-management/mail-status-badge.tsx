import React from "react";
import { CheckCircle2, AlertTriangle, XCircle, Info, HelpCircle, ShieldCheck, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";

export type MailStatusType =
  | "healthy"
  | "pass"
  | "online"
  | "active"
  | "listening"
  | "attention"
  | "pending"
  | "warning"
  | "configuration_required"
  | "failed"
  | "critical"
  | "suspended"
  | "error"
  | "offline"
  | "not_configured"
  | "untested"
  | "inactive"
  | "info"
  | "ready"
  | "ready_for_publishing";

interface MailStatusBadgeProps {
  status: MailStatusType | string;
  label?: string;
  size?: "sm" | "md";
  className?: string;
  showIcon?: boolean;
}

export function MailStatusBadge({
  status,
  label,
  size = "sm",
  className,
  showIcon = true,
}: MailStatusBadgeProps) {
  const norm = (status || "").toLowerCase().trim();

  let colorClass = "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700";
  let IconComponent = HelpCircle;
  let defaultLabel = label || status;

  // 1. Green: Healthy / Pass / Online / Active
  if (
    norm === "healthy" ||
    norm === "pass" ||
    norm === "online" ||
    norm === "active" ||
    norm === "listening" ||
    norm === "listening (starttls)" ||
    norm === "listening (tls/ssl)" ||
    norm === "ready" ||
    norm.includes("pass") ||
    norm.includes("generated")
  ) {
    colorClass = "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800";
    IconComponent = CheckCircle2;
    if (!label) defaultLabel = norm.toUpperCase();
  }
  // 2. Amber: Attention Required / Pending / Warning
  else if (
    norm === "attention" ||
    norm === "pending" ||
    norm === "warning" ||
    norm === "configuration_required" ||
    norm.includes("attention") ||
    norm.includes("required") ||
    norm.includes("pending")
  ) {
    colorClass = "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800";
    IconComponent = AlertTriangle;
    if (!label) defaultLabel = norm.toUpperCase();
  }
  // 3. Red: Failed / Critical / Suspended / Error
  else if (
    norm === "failed" ||
    norm === "critical" ||
    norm === "suspended" ||
    norm === "error" ||
    norm === "offline" ||
    norm.includes("fail") ||
    norm.includes("critical")
  ) {
    colorClass = "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800";
    IconComponent = XCircle;
    if (!label) defaultLabel = norm.toUpperCase();
  }
  // 4. Blue: Information / Ready for publishing
  else if (norm === "info" || norm.includes("publishing")) {
    colorClass = "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800";
    IconComponent = Info;
    if (!label) defaultLabel = label || "INFO";
  }
  // 5. Grey: Not Configured / Untested / Inactive
  else {
    colorClass = "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700";
    IconComponent = HelpCircle;
    if (!label) defaultLabel = norm ? norm.toUpperCase() : "NOT TESTED";
  }

  const isSmall = size === "sm";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 font-bold rounded-full border shadow-xs transition-colors",
        isSmall ? "text-[10px] px-2 py-0.5" : "text-xs px-2.5 py-1",
        colorClass,
        className
      )}
    >
      {showIcon && <IconComponent className={cn(isSmall ? "h-3 w-3" : "h-3.5 w-3.5", "shrink-0")} />}
      <span className="tracking-wide">{label || defaultLabel}</span>
    </span>
  );
}

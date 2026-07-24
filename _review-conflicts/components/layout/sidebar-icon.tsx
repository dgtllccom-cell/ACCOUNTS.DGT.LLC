"use client";

import type { LucideIcon } from "lucide-react";
import {
  Banknote,
  BarChart3,
  Bell,
  BookOpenText,
  Building2,
  ClipboardList,
  FileText,
  GanttChartSquare,
  LayoutDashboard,
  ListPlus,
  Mail,
  MessageSquare,
  Palette,
  ScrollText,
  Search,
  Settings2,
  Users,
  Truck
} from "lucide-react";
import type { SidebarIconKey } from "@/lib/navigation/sidebar";
import { cn } from "@/lib/utils";

const iconMap: Record<SidebarIconKey, LucideIcon> = {
  "layout-dashboard": LayoutDashboard,
  "list-plus": ListPlus,
  "building-2": Building2,
  users: Users,
  gantt: GanttChartSquare,
  "file-text": FileText,
  "clipboard-list": ClipboardList,
  "book-open": BookOpenText,
  banknote: Banknote,
  "scroll-text": ScrollText,
  settings: Settings2,
  "bar-chart": BarChart3,
  "message-square": MessageSquare,
  mail: Mail,
  bell: Bell,
  palette: Palette,
  search: Search,
  truck: Truck
};

export function SidebarIcon({ name, className }: { name?: SidebarIconKey; className?: string }) {
  if (!name) return null;
  const Icon = iconMap[name];
  if (!Icon) return null;
  return <Icon className={cn("h-4 w-4", className)} aria-hidden />;
}

"use client";

import type { LucideIcon } from "lucide-react";
import {
  Banknote,
  BarChart3,
  Bell,
  BookOpenText,
  Building2,
  Calculator,
  CalendarDays,
  CheckSquare,
  ClipboardList,
  Clock,
  Coins,
  CreditCard,
  FileSpreadsheet,
  FileText,
  GanttChartSquare,
  Globe,
  LayoutDashboard,
  ListPlus,
  Mail,
  MessageSquare,
  Package,
  Palette,
  Phone,
  Scale,
  ScrollText,
  Search,
  Send,
  Settings2,
  ShieldCheck,
  ShoppingBag,
  Users,
  Truck,
  Video
} from "lucide-react";
import type { SidebarIconKey } from "@/lib/navigation/sidebar";
import { cn } from "@/lib/utils";

const iconMap: Partial<Record<SidebarIconKey, LucideIcon>> = {
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
  truck: Truck,
  video: Video,
  "bar-chart-3": BarChart3,
  calculator: Calculator,
  calendar: CalendarDays,
  "check-square": CheckSquare,
  clock: Clock,
  coins: Coins,
  "credit-card": CreditCard,
  "file-spreadsheet": FileSpreadsheet,
  globe: Globe,
  package: Package,
  phone: Phone,
  scale: Scale,
  send: Send,
  "shield-check": ShieldCheck,
  "shopping-bag": ShoppingBag
};

export function SidebarIcon({ name, className }: { name?: SidebarIconKey; className?: string }) {
  if (!name) return null;
  const Icon = iconMap[name];
  if (!Icon) return null;
  return <Icon className={cn("h-4 w-4", className)} aria-hidden />;
}

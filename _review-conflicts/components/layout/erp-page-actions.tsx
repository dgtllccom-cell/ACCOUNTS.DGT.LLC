"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  Edit3,
  Mail,
  MoreVertical,
  Printer,
  RefreshCw,
  Send,
  Share2,
  X
} from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { DownloadActionIcon } from "@/components/ui/download-action-icon";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function titleFromPath(pathname: string) {
  const lastSegment = pathname
    .split("/")
    .filter(Boolean)
    .filter((segment) => segment !== "dashboard")
    .at(-1);

  if (!lastSegment) return "Dashboard";

  return lastSegment
    .replace(/\?.*$/, "")
    .split("-")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function currentUrl() {
  if (typeof window === "undefined") return "";
  return window.location.href;
}

function parentPathFor(pathname: string) {
  const explicitParents: Record<string, string> = {
    "/dashboard/new-entry/branch-entry/country-branch": "/dashboard/branch-management/general-report",
    "/dashboard/new-entry/branch-entry/city-branch": "/dashboard/branch-management/general-report",
    "/dashboard/new-entry/branches/super-admin": "/dashboard/branch-management/general-report",
    "/dashboard/new-entry/users/registration": "/dashboard/new-entry/users/journal-report",
    "/dashboard/new-entry/users/journal-report": "/dashboard/new-entry/users/journal-report",
    "/dashboard/accounts/setup": "/dashboard/accounts",
    "/dashboard/accounts/view": "/dashboard/accounts",
    "/dashboard/purchase/new-purchase-booking-order": "/dashboard/purchase/purchase-order",
    "/dashboard/purchase/purchase-confirm": "/dashboard/purchase/purchase-order",
    "/dashboard/roznamcha/cash-entry": "/dashboard/roznamcha/all"
  };

  if (explicitParents[pathname]) return explicitParents[pathname];

  const parts = pathname.split("/").filter(Boolean);
  if (parts.length <= 1) return "/dashboard";
  if (parts.length === 2 && parts[0] === "dashboard") return "/dashboard";
  return `/${parts.slice(0, -1).join("/")}`;
}

export function ErpPageActions() {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const title = titleFromPath(pathname || "/dashboard");

  useEffect(() => {
    if (!open) return;

    function onMouseDown(event: MouseEvent) {
      if (!menuRef.current) return;
      if (menuRef.current.contains(event.target as Node)) return;
      setOpen(false);
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function closeAndRun(action: () => void) {
    setOpen(false);
    action();
  }

  function goBack() {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
      return;
    }
    router.push("/dashboard");
  }

  function closePage() {
    router.push(parentPathFor(pathname || "/dashboard") as any);
  }

  function editCurrentRecord() {
    const params = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
    params.set("mode", "edit");
    router.push(`${pathname}?${params.toString()}` as any);
  }

  function emailPage() {
    const subject = encodeURIComponent(`ERP Page: ${title}`);
    const body = encodeURIComponent(`Please review this ERP page:\n\n${currentUrl()}`);
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  }

  function whatsAppShare() {
    const text = encodeURIComponent(`${title}\n${currentUrl()}`);
    window.open(`https://wa.me/?text=${text}`, "_blank", "noopener,noreferrer");
  }

  return (
    <section className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white/90 px-3 py-2 shadow-sm dark:border-slate-800 dark:bg-slate-900/80">
      <div className="flex min-w-0 items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={goBack}
          className="h-7 gap-1 rounded-lg px-2 text-[10px] font-bold"
          aria-label="Back to previous page"
          title="Back"
        >
          <ArrowLeft className="h-3 w-3" aria-hidden />
          Back
        </Button>
        <div id="erp-page-title-slot" className="min-w-0 empty:hidden" />
        <style>{`#erp-page-title-slot:not(:empty) + .default-title { display: none; }`}</style>
        <div className="min-w-0 default-title">
          <h1 className="truncate text-sm font-black text-slate-900 dark:text-slate-100">{title}</h1>
          <p className="hidden text-[10px] font-semibold text-slate-400 sm:block">Standard ERP navigation and page actions</p>
        </div>
      </div>

      <div className="flex items-center gap-1.5">
        <div id="erp-page-actions-slot" className="flex items-center gap-1.5 empty:hidden" />
        <div ref={menuRef} className="relative">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setOpen((current) => !current)}
            className="h-7 gap-1.5 rounded-lg px-2 text-[10px] font-bold"
            aria-label="Open page actions menu"
            title="Page actions"
          >
            <MoreVertical className="h-3.5 w-3.5" aria-hidden />
            Actions
          </Button>

          {open ? (
            <div className={cn("absolute right-0 top-full z-40 mt-2 w-56 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900")}>
              <button type="button" onClick={() => closeAndRun(() => window.print())} className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-800">
                <Printer className="h-4 w-4" aria-hidden />
                Print
              </button>
              <button type="button" onClick={() => closeAndRun(() => window.print())} className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-800">
                <DownloadActionIcon className="h-4 w-4" aria-hidden />
                PDF Download
              </button>
              <button type="button" onClick={() => closeAndRun(emailPage)} className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-800">
                <Mail className="h-4 w-4" aria-hidden />
                Email
              </button>
              <button type="button" onClick={() => closeAndRun(whatsAppShare)} className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-800">
                <Send className="h-4 w-4" aria-hidden />
                WhatsApp Share
              </button>
              <button type="button" onClick={() => closeAndRun(editCurrentRecord)} className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-800">
                <Edit3 className="h-4 w-4" aria-hidden />
                Edit
              </button>
              <button type="button" onClick={() => closeAndRun(() => window.location.reload())} className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-800">
                <RefreshCw className="h-4 w-4" aria-hidden />
                Refresh
              </button>
              <button type="button" onClick={() => closeAndRun(() => navigator.clipboard?.writeText(currentUrl()))} className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-800">
                <Share2 className="h-4 w-4" aria-hidden />
                Copy Link
              </button>
            </div>
          ) : null}
        </div>

        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={closePage}
          className="h-7 w-7 rounded-lg text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:text-rose-400 dark:hover:bg-rose-950/30"
          aria-label="Close current page"
          title="Close"
        >
          <X className="h-3.5 w-3.5" aria-hidden />
        </Button>
      </div>
    </section>
  );
}

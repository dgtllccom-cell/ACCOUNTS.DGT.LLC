"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import { t } from "@/lib/i18n/ui";

export function PrintButton() {
  const lang = useActiveLanguage();
  return (
    <Button
      type="button"
      onClick={() => window.print()}
      className="rounded-lg bg-amber-500 text-slate-950 hover:bg-amber-400"
    >
      <Printer className="h-4 w-4" aria-hidden />
      {t(lang, "common.print", "Print")}
    </Button>
  );
}


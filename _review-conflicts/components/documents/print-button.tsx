"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PrintButton() {
  return (
    <Button
      type="button"
      onClick={() => window.print()}
      className="rounded-lg bg-amber-500 text-slate-950 hover:bg-amber-400"
    >
      <Printer className="h-4 w-4" aria-hidden />
      Print
    </Button>
  );
}


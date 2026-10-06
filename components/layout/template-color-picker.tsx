"use client";

import { useEffect, useMemo, useState } from "react";
import type { SupportedLanguage } from "@/lib/i18n/languages";
import { t } from "@/lib/i18n/ui";
import { applyTemplateColor, normalizeTemplateColor, templateColors, type TemplateColor } from "@/lib/ui/template-colors";
import { cn } from "@/lib/utils";

function getInitialColor(): TemplateColor {
  if (typeof document === "undefined") return "purple";
  const classes = document.documentElement.classList;
  for (const c of templateColors) {
    if (classes.contains(`theme-${c.id}`)) return c.id;
  }
  return normalizeTemplateColor(typeof localStorage !== "undefined" ? localStorage.getItem("erp_color") : null);
}

export function TemplateColorPicker({
  lang,
  size = "md",
  className
}: {
  lang: SupportedLanguage;
  size?: "sm" | "md";
  className?: string;
}) {
  const [mounted, setMounted] = useState(false);
  const [color, setColor] = useState<TemplateColor>("purple");

  const dotSize = size === "sm" ? "h-4 w-4" : "h-5 w-5";
  const ringSize = size === "sm" ? "ring-2" : "ring-2";

  const labels = useMemo(() => {
    const map: Record<TemplateColor, string> = {
      purple: t(lang, "nav.template_purple"),
      blue: t(lang, "nav.template_blue"),
      green: t(lang, "nav.template_green"),
      gold: t(lang, "nav.template_gold"),
      cyan: t(lang, "nav.template_cyan")
    };
    return map;
  }, [lang]);

  useEffect(() => {
    setMounted(true);
    setColor(getInitialColor());
    const onStorage = (event: StorageEvent) => {
      if (event.key === "erp_color") {
        const next = normalizeTemplateColor(event.newValue);
        applyTemplateColor(next);
        setColor(next);
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  function choose(next: TemplateColor) {
    applyTemplateColor(next);
    localStorage.setItem("erp_color", next);
    document.cookie = `erp_color=${encodeURIComponent(next)}; Path=/; Max-Age=${60 * 60 * 24 * 365}; SameSite=Lax`;
    setColor(next);
  }

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {templateColors.map((c) => (
        <button
          key={c.id}
          type="button"
          className={cn(
            "relative inline-flex items-center justify-center rounded-full border bg-background/60 transition",
            dotSize,
            mounted && color === c.id ? cn("ring-primary", ringSize) : "ring-0",
            "hover:bg-background"
          )}
          style={{ borderColor: "hsl(var(--border))" }}
          onClick={() => choose(c.id)}
          aria-label={labels[c.id]}
          title={labels[c.id]}
        >
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: c.hex }} aria-hidden />
        </button>
      ))}
    </div>
  );
}


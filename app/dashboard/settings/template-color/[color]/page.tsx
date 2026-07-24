"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import type { TemplateColor } from "@/lib/ui/template-colors";
import { applyTemplateColor, normalizeTemplateColor } from "@/lib/ui/template-colors";

export default function TemplateColorApplyPage() {
  const params = useParams();
  const router = useRouter();

  useEffect(() => {
    const raw = (params as Record<string, string | string[] | undefined>)?.color;
    const color = normalizeTemplateColor(Array.isArray(raw) ? raw[0] ?? "" : raw ?? "");
    applyTemplateColor(color as TemplateColor);
    localStorage.setItem("erp_color", color);
    document.cookie = `erp_color=${encodeURIComponent(color)}; Path=/; Max-Age=${60 * 60 * 24 * 365}; SameSite=Lax`;
    router.replace("/dashboard/settings");
  }, [params, router]);

  return null;
}

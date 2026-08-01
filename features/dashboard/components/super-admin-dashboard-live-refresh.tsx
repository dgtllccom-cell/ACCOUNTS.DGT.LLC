"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClientSupabaseClient } from "@/lib/supabase/client";

const LIVE_TABLES = [
  "countries", "country_branches", "city_branches", "profiles", "user_role_assignments",
  "customers", "companies", "purchase_orders", "sales_orders", "ledgers", "roznamcha_entries"
] as const;

export function SuperAdminDashboardLiveRefresh() {
  const router = useRouter();
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const refresh = () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
      refreshTimer.current = setTimeout(() => router.refresh(), 350);
    };

    const supabase = createClientSupabaseClient();
    let channel = supabase.channel("super-admin-dashboard-live");
    for (const table of LIVE_TABLES) {
      channel = channel.on("postgres_changes", { event: "*", schema: "public", table }, refresh);
    }
    channel.subscribe();

    const polling = window.setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, 30_000);
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
      window.clearInterval(polling);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      void supabase.removeChannel(channel);
    };
  }, [router]);

  return null;
}

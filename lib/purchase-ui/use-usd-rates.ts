"use client";

import { useEffect, useState } from "react";

/** Latest daily USD rates (units of currency per 1 USD) for the approved Purchase headers. `{}` until loaded or when none exist. */
export function useUsdRates(enabled = true): Record<string, number> {
  const [rates, setRates] = useState<Record<string, number>>({});
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    void fetch("/api/erp/purchases/usd-rates", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => { if (!cancelled && j?.ok && j.data?.rates) setRates(j.data.rates); })
      .catch(() => { /* no rates -> mixed-currency totals show "—" */ });
    return () => { cancelled = true; };
  }, [enabled]);
  return rates;
}

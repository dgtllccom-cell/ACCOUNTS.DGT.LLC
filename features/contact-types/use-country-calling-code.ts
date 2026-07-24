"use client";

import { useEffect, useMemo, useState } from "react";
import { getCountryContactRules, type ContactTypeKey } from "@/features/contact-types/contact-type-api";

export function useCountryCallingCodes(countryId: string | null) {
  const [loading, setLoading] = useState(false);
  const [rules, setRules] = useState<Array<{ key: ContactTypeKey; callingCode: string }>>([]);

  useEffect(() => {
    let cancelled = false;
    if (!countryId) {
      setRules([]);
      return;
    }

    (async () => {
      setLoading(true);
      try {
        const res = await getCountryContactRules(countryId);
        if (cancelled) return;
        const rows = Array.isArray(res.rules) ? res.rules : [];
        setRules(rows.map((r) => ({ key: r.contactTypeKey, callingCode: r.callingCode })));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [countryId]);

  const callingCodeByType = useMemo(() => {
    const map = new Map<ContactTypeKey, string>();
    for (const r of rules) map.set(r.key, r.callingCode);
    return map;
  }, [rules]);

  return { loading, callingCodeByType };
}


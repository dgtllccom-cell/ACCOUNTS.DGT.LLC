"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { t } from "@/lib/i18n/ui";

type Opt = { id: string; label: string; sub?: string };

const SOURCES: Record<string, { url: (q: string) => string; map: (row: any) => Opt }> = {
  // Party / Customer master
  customer: {
    url: (q) => `/api/erp/customers?q=${encodeURIComponent(q)}&limit=20`,
    map: (r) => ({ id: r.id, label: r.customer_name || r.company_name || r.person_code || r.id, sub: r.company_name && r.customer_name ? r.company_name : r.mobile || undefined }),
  },
  // Accounts master (best-match lookup)
  account: {
    url: (q) => `/api/erp/accounting/accounts/lookup?q=${encodeURIComponent(q)}&limit=20`,
    map: (r) => ({ id: r.ledgerId || r.id || r.accountId, label: r.accountName || r.ledgerName || r.accountCode || r.id, sub: r.accountCode || r.companyName || undefined }),
  },
  // Goods master
  goods: {
    url: (q) => `/api/erp/goods?q=${encodeURIComponent(q)}&limit=20`,
    map: (r) => ({ id: r.id, label: r.goods_name || r.name || r.id, sub: r.category_name || undefined }),
  },
};

/**
 * Async master picker for the Consignment Register. Reuses the existing ERP
 * masters (Customer / Account / Goods) — never a new master table — and ALWAYS
 * allows a plain typed name, because this is an old-account / temporary register
 * where the party or goods may not exist in the master yet.
 *
 * onChange gives you both the free-text name (always) and the linked master id
 * (only when a suggestion was picked).
 */
export function MasterCombo({
  source,
  value,
  linkedId,
  onChange,
  placeholder,
  lang,
  className = "",
}: {
  source: "customer" | "account" | "goods";
  value: string;
  linkedId?: string | null;
  onChange: (name: string, linkedId: string | null) => void;
  placeholder?: string;
  lang: string;
  className?: string;
}) {
  const cfg = SOURCES[source];
  const [open, setOpen] = useState(false);
  const [opts, setOpts] = useState<Opt[]>([]);
  const [loading, setLoading] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = useCallback(
    (q: string) => {
      if (timer.current) clearTimeout(timer.current);
      if (!q.trim() || q.trim().length < 2) {
        setOpts([]);
        return;
      }
      timer.current = setTimeout(async () => {
        setLoading(true);
        try {
          const res = await fetch(cfg.url(q.trim()), { credentials: "same-origin" });
          const body = await res.json().catch(() => ({}));
          const data = body?.data ?? body;
          let rows: any[] = [];
          if (source === "customer") rows = data.customers ?? [];
          else if (source === "goods") rows = data.goods ?? [];
          else if (source === "account") rows = data.account ? [data.account] : [];
          setOpts(rows.map(cfg.map).filter((o: Opt) => o.id && o.label));
        } catch {
          setOpts([]);
        } finally {
          setLoading(false);
        }
      }, 280);
    },
    [cfg, source],
  );

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  return (
    <div ref={boxRef} className={`relative ${className}`}>
      <div className="flex items-center gap-1">
        <input
          value={value}
          placeholder={placeholder ?? t(lang, "cns.search_master", "Search or type a name…")}
          onChange={(e) => {
            onChange(e.target.value, null); // typing clears any prior link
            search(e.target.value);
            setOpen(true);
          }}
          onFocus={() => value && setOpen(true)}
          className="h-8 w-full rounded-md border border-border bg-background px-2 text-xs outline-none"
        />
        {linkedId && (
          <span title={t(lang, "cns.linked_master", "Linked to master record")} className="shrink-0 rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-bold text-emerald-600">
            ✓
          </span>
        )}
      </div>
      {open && (loading || opts.length > 0) && (
        <div className="absolute z-30 mt-1 max-h-52 w-full overflow-auto rounded-md border border-border bg-popover shadow-lg">
          {loading && <div className="px-2.5 py-2 text-xs text-muted-foreground">{t(lang, "cns.searching", "Searching…")}</div>}
          {opts.map((o) => (
            <button
              key={o.id}
              type="button"
              onClick={() => {
                onChange(o.label, o.id);
                setOpen(false);
              }}
              className="block w-full px-2.5 py-1.5 text-start text-xs hover:bg-muted"
            >
              <span className="font-semibold text-foreground">{o.label}</span>
              {o.sub && <span className="ms-1.5 text-muted-foreground">· {o.sub}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

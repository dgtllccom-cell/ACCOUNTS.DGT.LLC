"use client";
import { useEffect, useState } from 'react';

type History = { payments: Record<string, any>[] | null; complete: boolean; loading: boolean };
export function usePurchaseInvoiceHistory(ids: string, enabled: boolean, refresh: number) {
  const [history, setHistory] = useState<Record<string, History>>({});
  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    const queue: string[] = JSON.parse(ids);
    setHistory(Object.fromEntries(queue.map(id => [id, { payments: null, complete: false, loading: true }])));
    const work = async () => {
      while (queue.length && !controller.signal.aborted) {
        const id = queue.shift()!;
        let result: History = { payments: null, complete: false, loading: false };
        try {
          const response = await fetch(`/api/erp/purchases/orders/${encodeURIComponent(id)}/payments?summary=1`, { credentials: 'include', cache: 'no-store', signal: controller.signal });
          const body = await response.json();
          if (response.ok && body?.ok && Array.isArray(body.data?.payments)) result = {
            payments: body.data.payments, complete: body.data.payments.length < Number(body.data.limit || 200), loading: false,
          };
        } catch { /* Unavailable history renders unknown, never zero or an aggregate paid twice. */ }
        if (!controller.signal.aborted) setHistory(old => ({ ...old, [id]: result }));
      }
    };
    void Promise.all(Array.from({ length: Math.min(4, queue.length) }, work));
    return () => controller.abort();
  }, [ids, enabled, refresh]);
  return history;
}

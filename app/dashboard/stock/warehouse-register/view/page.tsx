"use client";

import Link from "next/link";
import { Suspense, useEffect, useState, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { translateHeader } from "@/lib/i18n/table-headers";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import type { BillDetail, LoadDetail, TransferDetail } from "@/lib/stock/register-detail";

type Detail = BillDetail | LoadDetail | TransferDetail;

const fmt = (n: number | null | undefined) => (n === null || n === undefined ? "—" : n.toLocaleString("en-US", { maximumFractionDigits: 3 }));
const val = (v: string | number | null | undefined) => (v === null || v === undefined || v === "" ? "—" : String(v));

const PRINT_CSS = `
@media print {
  @page { size: A4 landscape; margin: 8mm; }
  body * { visibility: hidden !important; }
  #register-print-area, #register-print-area * { visibility: visible !important; }
  #register-print-area { position: absolute; left: 0; top: 0; width: 100%; }
  .no-print { display: none !important; }
}`;

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <h2 className="bg-teal-800 px-3 py-1.5 text-[11px] font-black uppercase text-white">{title}</h2>
      <div className="p-3">{children}</div>
    </section>
  );
}

function Fields({ items }: { items: Array<[string, string]> }) {
  return (
    <dl className="grid grid-cols-1 gap-x-4 gap-y-1.5 sm:grid-cols-2 xl:grid-cols-3">
      {items.map(([k, v]) => (
        <div key={k} className="min-w-0">
          <dt className="text-[10px] font-black uppercase text-slate-500">{k}</dt>
          <dd className="break-words text-[12px] font-semibold text-black">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

function Grid({ head, rows }: { head: string[]; rows: Array<Array<string>> }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] text-[11px]">
        <thead className="bg-slate-100 text-[10px] font-black uppercase text-slate-700">
          <tr>
            {head.map((h) => (
              <th key={h} className="px-2 py-1 text-start">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={head.length} className="px-2 py-3 text-center text-slate-500">—</td>
            </tr>
          )}
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-slate-100">
              {r.map((c, j) => (
                <td key={j} className="px-2 py-1 text-black">{c}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ViewInner() {
  const lang = useActiveLanguage();
  const t = (label: string) => translateHeader(lang, label);
  const isRtl = ["ur", "ar", "fa", "ps"].includes(lang);
  const router = useRouter();
  const sp = useSearchParams();
  const kind = sp.get("kind") ?? "";
  const type = sp.get("type") ?? "";
  const id = sp.get("id") ?? "";
  const [detail, setDetail] = useState<Detail | null>(null);
  const [error, setError] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const qs = new URLSearchParams({ kind, id, lang });
    if (type) qs.set("type", type);
    setLoading(true);
    setError("");
    fetch(`/api/erp/stock/warehouse-register/detail?${qs.toString()}`, { credentials: "include", cache: "no-store" })
      .then(async (res) => {
        const body = await res.json();
        if (!res.ok || !body?.ok) throw new Error(body?.error?.message || "load failed");
        if (!cancelled) setDetail(body.data.detail);
      })
      .catch((e) => {
        if (!cancelled) {
          setDetail(null);
          setError(String(e?.message || "load failed"));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [kind, type, id, lang]);

  const back = () => router.push("/dashboard/stock/warehouse-register");

  return (
    <div dir={isRtl ? "rtl" : "ltr"} className="w-full space-y-3 p-3 md:p-4">
      <style dangerouslySetInnerHTML={{ __html: PRINT_CSS }} />
      <header className="no-print flex flex-wrap items-center justify-between gap-2">
        <button type="button" onClick={back} className="h-8 rounded-md border border-slate-300 bg-white px-3 text-[11px] font-semibold">
          ← {t("WAREHOUSE STOCK REGISTER")}
        </button>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => window.print()} className="h-8 rounded-md bg-teal-800 px-3 text-[11px] font-bold text-white">{t("PRINT")}</button>
          <button type="button" onClick={() => window.print()} className="h-8 rounded-md border border-teal-800 px-3 text-[11px] font-bold text-teal-800">{t("PDF")}</button>
          <button type="button" onClick={back} className="h-8 rounded-md border border-slate-300 bg-white px-3 text-[11px] font-semibold">{t("CLOSE")}</button>
        </div>
      </header>

      {loading && <p className="text-[12px] text-slate-500">{t("LOADING")}</p>}
      {!loading && error && (
        <div className="rounded-md border border-rose-300 bg-rose-50 p-3 text-[12px] text-rose-800">{error}</div>
      )}

      {!loading && detail && (
        <div id="register-print-area" className="space-y-3">
          {detail.kind === "bill" && (
            <>
              <h1 className="text-lg font-black text-black">
                {t("BILL DETAILS")} — {detail.purchaseNo}
              </h1>
              <Section title={t("BILL DETAILS")}>
                <Fields
                  items={[
                    [t("PURCHASE NO."), detail.purchaseNo],
                    [t("PURCHASE DATE"), detail.purchaseDate],
                    [t("PURCHASE TYPE"), detail.billType === "booking" ? t("PURCHASE BOOKING") : t("LOCAL PURCHASE")],
                    [t("MANUAL BILL NO"), detail.manualNo],
                    [t("SUPPLIER"), detail.supplier],
                    [t("SALES ACCOUNT"), detail.salesAccount],
                    [t("COUNTRY"), detail.country],
                    [t("BRANCH"), detail.branch],
                    [t("PURCHASE CURRENCY"), detail.currency],
                    [t("EXCHANGE RATE"), fmt(detail.exchangeRate)],
                    [t("FINAL AMOUNT"), fmt(detail.totalAmount)],
                    [t("PAYMENT TYPE"), detail.paymentType],
                    [t("STATUS"), detail.status],
                    [t("PAYMENT STATUS"), detail.paymentStatus],
                  ]}
                />
              </Section>
              <Section title={t("GOODS NAME")}>
                <Grid
                  head={[t("GOODS NAME"), t("QTY"), t("UNIT"), t("GROSS WT (KG)"), t("NET WT (KG)"), t("FINAL AMOUNT"), t("PURCHASE CURRENCY")]}
                  rows={detail.goods.map((g) => [g.goodsName, fmt(g.qty), g.unit || "—", fmt(g.gross), fmt(g.net), fmt(g.totalAmount), g.currency])}
                />
              </Section>
              <Section title={t("LOADING & STOCK TRANSFER ENTRIES")}>
                <Grid
                  head={[t("ENTRY NO."), t("LOADING DATE"), t("GOODS NAME"), t("LOADED QUANTITY"), t("UNIT"), t("GROSS WT (KG)"), t("NET WT (KG)"), t("CONTAINER NUMBER"), t("TRUCK NUMBER"), t("DRIVER"), t("BL NUMBER"), t("LOADING COUNTRY"), t("RECEIVING COUNTRY"), t("STATUS"), t("DESTINATION")]}
                  rows={detail.loads.map((l) => [l.loadingNo, l.loadingDate, l.goodsName, fmt(l.qty), l.unit || "—", fmt(l.gross), fmt(l.net), l.container, l.truck, l.driver, l.bl, l.loadingPort, l.receivingPort, l.status, l.disposition])}
                />
                <div className="no-print mt-2 flex flex-wrap gap-2 text-[11px]">
                  {detail.loads.map((l) => (
                    <Link key={l.id} href={`/dashboard/stock/warehouse-register/view?kind=loading&id=${l.id}`} className="rounded border border-amber-300 bg-amber-50 px-2 py-1 font-bold text-amber-900">
                      {t("VIEW")} · {l.loadingNo}
                    </Link>
                  ))}
                </div>
              </Section>
              <Section title={t("TRANSFER HISTORY")}>
                <Grid
                  head={[t("TRANSFER NO."), t("TRANSFER DATE"), t("DESTINATION"), t("WAREHOUSE"), t("GOODS NAME"), t("QTY"), t("UNIT"), t("STATUS"), t("REFERENCE")]}
                  rows={detail.transfers.map((x) => [x.transferNo, x.date, x.destination, x.warehouse, x.goodsName, fmt(x.qty), x.unit || "—", x.status, x.reference])}
                />
                <div className="no-print mt-2 flex flex-wrap gap-2 text-[11px]">
                  {detail.transfers.map((x) => (
                    <Link key={x.id} href={`/dashboard/stock/warehouse-register/view?kind=transfer&id=${x.id}`} className="rounded border border-violet-300 bg-violet-50 px-2 py-1 font-bold text-violet-900">
                      {t("VIEW")} · {x.transferNo}
                    </Link>
                  ))}
                </div>
              </Section>
              <Section title={t("REMAINING BALANCE")}>
                <Fields
                  items={[
                    [t("ORIGINAL QUANTITY"), fmt(detail.quantities.original)],
                    [t("LOADED QUANTITY"), fmt(detail.quantities.loaded)],
                    [t("TRANSFERRED QUANTITY"), fmt(detail.quantities.transferred)],
                    [t("REMAINING BALANCE"), fmt(detail.quantities.remaining)],
                  ]}
                />
              </Section>
            </>
          )}

          {detail.kind === "loading" && (
            <>
              <h1 className="text-lg font-black text-black">{t("ENTRY DETAILS")} — {detail.loadingNo}</h1>
              <Section title={t("ORIGINAL BILL")}>
                <Fields
                  items={[
                    [t("PURCHASE NO."), detail.purchaseNo],
                    [t("PURCHASE TYPE"), detail.billType === "booking" ? t("PURCHASE BOOKING") : detail.billType === "local" ? t("LOCAL PURCHASE") : "—"],
                    [t("ENTRY NO."), detail.loadingNo],
                    [t("GOODS NAME"), detail.goodsName],
                    [t("LOADED QUANTITY"), `${fmt(detail.qty)} ${detail.unit}`],
                    [t("GROSS WT (KG)"), fmt(detail.gross)],
                    [t("NET WT (KG)"), fmt(detail.net)],
                    [t("TARE WT (KG)"), fmt(detail.tare)],
                    [t("STOCK IN LANE"), fmt(detail.stockInLane)],
                    [t("STATUS"), detail.status],
                  ]}
                />
              </Section>
              <Section title={t("LOADING DATE")}>
                <Fields
                  items={[
                    [t("LOADING DATE"), detail.loadingDate],
                    [t("LOADING COUNTRY"), detail.loadingPort],
                    [t("RECEIVING COUNTRY"), detail.receivingPort],
                    [t("CONTAINER NUMBER"), detail.container],
                    [t("CONTAINER TYPE"), detail.containerType],
                    [t("SEAL NUMBERS"), detail.seal],
                    [t("TRUCK NUMBER"), detail.truck],
                    [t("DRIVER"), detail.driver],
                    [t("BL NUMBER"), detail.bl],
                    [t("TRANSPORT MODE"), detail.transport],
                  ]}
                />
              </Section>
              <Section title={t("DESTINATION")}>
                <Fields
                  items={[
                    [t("DESTINATION"), detail.disposition],
                    [t("TRANSFER DATE"), detail.dispositionAt],
                    [t("REMARKS"), detail.dispositionNote],
                  ]}
                />
              </Section>
              <Section title={t("TRANSFER HISTORY")}>
                <Grid
                  head={[t("TRANSFER DATE"), t("EVENT"), t("FROM"), t("TO"), t("DETAIL"), t("ACTOR")]}
                  rows={detail.history.map((h) => [h.at, h.event, h.from, h.to, h.detail, h.actor])}
                />
              </Section>
            </>
          )}

          {detail.kind === "transfer" && (
            <>
              <h1 className="text-lg font-black text-black">{t("ENTRY DETAILS")} — {detail.transferNo}</h1>
              <Section title={t("ORIGINAL BILL")}>
                <Fields
                  items={[
                    [t("PURCHASE NO."), detail.purchaseNo],
                    [t("PURCHASE TYPE"), detail.billType === "booking" ? t("PURCHASE BOOKING") : detail.billType === "local" ? t("LOCAL PURCHASE") : "—"],
                    [t("TRANSFER NO."), detail.transferNo],
                    [t("TRANSFER DATE"), detail.date],
                    [t("DESTINATION"), detail.destination],
                    [t("WAREHOUSE"), detail.warehouse],
                    [t("GOODS NAME"), detail.goodsName],
                    [t("QTY"), `${fmt(detail.qty)} ${detail.unit}`],
                    [t("STATUS"), detail.status],
                    [t("REFERENCE"), detail.reference],
                    [t("CUSTOMER"), detail.customer],
                    [t("SALES ORDER NO."), detail.salesOrderNo],
                  ]}
                />
              </Section>
              <Section title={t("TRANSFER HISTORY")}>
                <Fields
                  items={[
                    [t("CONFIRMED"), detail.confirmedAt],
                    [t("ISSUED"), detail.issuedAt],
                    [t("REVERSED"), detail.reversedAt],
                    [t("REMARKS"), detail.remarks],
                  ]}
                />
              </Section>
            </>
          )}

          <footer className="text-[10px] text-slate-500">{t("STOCK ENTERS THIS REGISTER ONLY THROUGH A CONFIRMED WAREHOUSE TRANSFER.")}</footer>
        </div>
      )}
    </div>
  );
}

export default function WarehouseRegisterViewPage() {
  return (
    <Suspense fallback={null}>
      <ViewInner />
    </Suspense>
  );
}

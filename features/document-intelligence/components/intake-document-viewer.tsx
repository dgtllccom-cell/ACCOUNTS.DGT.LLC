"use client";

/**
 * Original-document viewer for Document Intake review.
 *
 * The reviewer must be able to compare every extracted value with the ORIGINAL, so this is a real viewer — not a
 * tiny iframe preview: fit to width, fit entire page, zoom, page navigation (n / total), rotate, full screen,
 * download, and open the original in its own full-size browser tab.
 * Pages are served by the authenticated, scope-checked `/page` route (PDF pages rendered once and cached).
 */

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Download, ExternalLink, Maximize2, Minimize2, MoveHorizontal, RotateCw, ScanLine, ZoomIn, ZoomOut, Loader2 } from "lucide-react";
import { apiGet } from "@/lib/api/client";

type Props = {
  jobId: string;
  mime: string;
  pageCount: number | null;
  /** controlled current page (1-based) so source-page chips elsewhere can jump here */
  page: number;
  onPageChange: (page: number) => void;
  T: (key: string, fallback: string) => string;
  /** CSS height of the viewing area when not full screen */
  heightClass?: string;
};

type Fit = "width" | "page" | "custom";

export function IntakeDocumentViewer({ jobId, mime, pageCount, page, onPageChange, T, heightClass = "h-[78vh] min-h-[460px]" }: Props) {
  const boxRef = useRef<HTMLDivElement>(null);
  const areaRef = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState<Fit>("width");
  const [zoom, setZoom] = useState(100); // % of the container width, used when fit === "custom"
  const [rotation, setRotation] = useState(0);
  const [full, setFull] = useState(false);
  const [total, setTotal] = useState<number>(pageCount ?? 0);
  const [nat, setNat] = useState<{ w: number; h: number } | null>(null);
  const [area, setArea] = useState<{ w: number; h: number }>({ w: 600, h: 700 });
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const isImage = mime.startsWith("image/");

  // page count: from the job once OCR has run, otherwise ask the server
  useEffect(() => {
    if (pageCount) { setTotal(pageCount); return; }
    if (isImage) { setTotal(1); return; }
    let live = true;
    apiGet<{ pages: number }>(`/api/erp/document-intelligence/${jobId}/page?info=1`).then((r) => { if (live && r?.pages) setTotal(r.pages); }).catch(() => undefined);
    return () => { live = false; };
  }, [jobId, pageCount, isImage]);

  // measure the viewing area (re-measured on resize and when entering / leaving full screen)
  useLayoutEffect(() => {
    const el = areaRef.current;
    if (!el) return;
    const measure = () => setArea({ w: Math.max(240, el.clientWidth - 16), h: Math.max(240, el.clientHeight - 16) });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [full]);

  useEffect(() => {
    const onFs = () => setFull(document.fullscreenElement === boxRef.current);
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  useEffect(() => { setLoading(true); setFailed(false); }, [jobId, page]);

  const maxPage = total || 1;
  const goto = useCallback((p: number) => onPageChange(Math.min(Math.max(1, p), maxPage)), [onPageChange, maxPage]);

  // displayed size of the (rotated) page, in px
  const rot90 = rotation % 180 !== 0;
  const ratio = nat ? nat.w / nat.h : 0.707; // w/h of the unrotated page
  const rr = rot90 ? 1 / ratio : ratio; // w/h of what the user sees
  let bw: number;
  if (fit === "width") bw = area.w;
  else if (fit === "page") bw = Math.min(area.w, area.h * rr);
  else bw = (area.w * zoom) / 100;
  const bh = bw / rr;
  const imgW = rot90 ? bh : bw;

  const scale = bw > 1100 ? 3 : 2;
  const src = `/api/erp/document-intelligence/${jobId}/page?n=${page}&scale=${isImage ? 2 : scale}`;

  const toggleFull = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await boxRef.current?.requestFullscreen();
    } catch { /* full screen not available (e.g. iframe policy) - the page stays usable */ }
  };

  const btn = "inline-flex h-8 min-w-8 items-center justify-center gap-1 rounded-md px-2 text-[11px] font-bold transition-colors hover:bg-slate-700 disabled:opacity-40";
  const active = "bg-blue-600 text-white hover:bg-blue-600";

  return (
    <div ref={boxRef} className={`flex flex-col bg-slate-100 dark:bg-slate-950 ${full ? "h-screen w-screen" : ""}`} data-testid="doc-viewer">
      <div className="flex flex-wrap items-center gap-1 bg-slate-900 px-2 py-1.5 text-white" dir="ltr">
        <button type="button" className={btn} disabled={page <= 1} onClick={() => goto(page - 1)} title={T("v_prev", "Previous page")} data-testid="v-prev"><ChevronLeft className="h-4 w-4" /></button>
        <span className="min-w-[64px] text-center font-mono text-xs font-bold" data-testid="v-pages">{page} / {total || "…"}</span>
        <button type="button" className={btn} disabled={page >= maxPage} onClick={() => goto(page + 1)} title={T("v_next", "Next page")} data-testid="v-next"><ChevronRight className="h-4 w-4" /></button>
        <span className="mx-1 h-5 w-px bg-slate-700" />
        <button type="button" className={`${btn} ${fit === "width" ? active : ""}`} onClick={() => setFit("width")} title={T("v_fit_width", "Fit to width")} data-testid="v-fit-width"><MoveHorizontal className="h-4 w-4" /></button>
        <button type="button" className={`${btn} ${fit === "page" ? active : ""}`} onClick={() => setFit("page")} title={T("v_fit_page", "Fit entire page")} data-testid="v-fit-page"><ScanLine className="h-4 w-4" /></button>
        <button type="button" className={btn} onClick={() => { setFit("custom"); setZoom((z) => Math.max(40, (fit === "custom" ? z : 100) - 20)); }} title={T("v_zoom_out", "Zoom out")} data-testid="v-zoom-out"><ZoomOut className="h-4 w-4" /></button>
        <span className="min-w-[44px] text-center font-mono text-xs" data-testid="v-zoom">{fit === "custom" ? `${zoom}%` : fit === "width" ? "100%" : T("v_fit", "fit")}</span>
        <button type="button" className={btn} onClick={() => { setFit("custom"); setZoom((z) => Math.min(400, (fit === "custom" ? z : 100) + 20)); }} title={T("v_zoom_in", "Zoom in")} data-testid="v-zoom-in"><ZoomIn className="h-4 w-4" /></button>
        <button type="button" className={btn} onClick={() => setRotation((r) => (r + 90) % 360)} title={T("v_rotate", "Rotate")} data-testid="v-rotate"><RotateCw className="h-4 w-4" /></button>
        <span className="mx-1 h-5 w-px bg-slate-700" />
        <button type="button" className={btn} onClick={() => void toggleFull()} title={full ? T("v_exit_full", "Exit full screen") : T("v_full", "Full screen")} data-testid="v-full">{full ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}</button>
        <a className={btn} href={`/api/erp/document-intelligence/${jobId}/file?download=1`} title={T("v_download", "Download original")} data-testid="v-download"><Download className="h-4 w-4" /></a>
        <a className={btn} href={`/api/erp/document-intelligence/${jobId}/file`} target="_blank" rel="noopener noreferrer" title={T("v_open", "Open original in a separate viewer")} data-testid="v-open"><ExternalLink className="h-4 w-4" /></a>
      </div>

      <div ref={areaRef} className={`relative flex-1 overflow-auto p-2 ${full ? "" : heightClass}`}>
        {loading && !failed && <div className="absolute inset-0 z-10 flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>}
        {failed ? (
          <p className="p-6 text-center text-xs font-semibold text-rose-600">{T("v_failed", "This page could not be shown. Use “Open original” to view the file.")}</p>
        ) : (
          <div className="mx-auto" style={{ position: "relative", width: bw, height: bh }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              key={`${jobId}-${page}-${scale}`}
              src={src}
              alt={`${T("original_doc", "Original document")} ${page}`}
              onLoad={(e) => { const i = e.currentTarget; setNat({ w: i.naturalWidth, h: i.naturalHeight }); setLoading(false); }}
              onError={() => { setLoading(false); setFailed(true); }}
              style={{ position: "absolute", left: "50%", top: "50%", width: imgW, maxWidth: "none", transform: `translate(-50%,-50%) rotate(${rotation}deg)`, background: "#fff", boxShadow: "0 2px 12px rgba(0,0,0,.25)" }}
              data-testid="v-page-img"
            />
          </div>
        )}
      </div>
    </div>
  );
}

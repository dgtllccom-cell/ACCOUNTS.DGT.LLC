"use client";

import { useEffect, useMemo, useState } from "react";
import { resolveLocationTheme, type LocationSelection } from "@/lib/location-backgrounds/config";
import { backdropDataUri } from "@/lib/location-backgrounds/backdrop-svg";

/**
 * Dynamic location backdrop — reusable across every location-scoped screen
 * (Global / Country Admin / Main Branch / City Branch / Clearing Agent).
 *
 * Give it the current country/state/city/branch selection; it resolves a theme
 * with the fallback chain (city → state → country → global), renders a
 * CSP-safe SVG gradient + landmark that ALWAYS shows, optionally layers a real
 * photo on top when one is configured and loads, and applies a readable
 * overlay so form fields / text stay clear.
 *
 * The image, gradient, label and (optional) title/subtitle all update the
 * instant the selection changes.
 */
export function LocationBackdrop({
  selection,
  title,
  subtitle,
  className = "",
  children,
  height = "auto",
  showLabel = true,
}: {
  selection: LocationSelection;
  title?: string;
  subtitle?: string;
  className?: string;
  children?: React.ReactNode;
  /** "auto" wraps children; a px/rem value renders a fixed banner */
  height?: string;
  showLabel?: boolean;
}) {
  const theme = useMemo(() => resolveLocationTheme(selection), [
    selection.iso2, selection.countryName, selection.stateName, selection.cityName, selection.branchName,
  ]);
  const svg = useMemo(() => backdropDataUri(theme), [theme]);
  const [photoOk, setPhotoOk] = useState(false);

  useEffect(() => {
    setPhotoOk(false);
    if (!theme.imageUrl) return;
    let alive = true;
    const img = new Image();
    img.referrerPolicy = "no-referrer";
    img.onload = () => { if (alive) setPhotoOk(true); };
    img.onerror = () => { if (alive) setPhotoOk(false); };
    img.src = theme.imageUrl;
    return () => { alive = false; };
  }, [theme.imageUrl]);

  const bgLayers = [
    // readable overlay (top)
    "linear-gradient(180deg, rgba(2,6,23,0.55) 0%, rgba(2,6,23,0.35) 40%, rgba(2,6,23,0.72) 100%)",
    photoOk && theme.imageUrl ? `url("${theme.imageUrl}")` : null,
    `url("${svg}")`,
  ].filter(Boolean).join(", ");

  const fixed = height !== "auto";

  return (
    <div
      className={`relative overflow-hidden rounded-2xl ${className}`}
      style={{
        backgroundImage: bgLayers,
        backgroundSize: "cover, cover, cover",
        backgroundPosition: "center",
        ...(fixed ? { height } : {}),
      }}
      data-location-theme={theme.key}
    >
      {(showLabel || title || subtitle) && (
        <div className="relative z-10 flex flex-col gap-0.5 px-4 py-3 text-white">
          {title && <h2 className="text-base font-black tracking-tight drop-shadow sm:text-lg">{title}</h2>}
          {subtitle && <p className="text-[11px] font-semibold text-white/85 drop-shadow sm:text-xs">{subtitle}</p>}
          {showLabel && (
            <span className="mt-0.5 inline-flex w-fit items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-0.5 text-[11px] font-bold backdrop-blur-sm">
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: theme.accent }} />
              {theme.label}
            </span>
          )}
        </div>
      )}
      {children && <div className="relative z-10">{children}</div>}
    </div>
  );
}

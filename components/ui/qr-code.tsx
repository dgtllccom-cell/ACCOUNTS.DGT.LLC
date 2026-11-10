"use client";

import { encodeByteMode } from "@/lib/qr/qr-core";
export * from "@/lib/qr/qr-core";

export type QrCodeProps = { value: string; size?: number; className?: string; quietZone?: number };

export function QrCode({ value, size: sizeProp = 132, className, quietZone = 4 }: QrCodeProps) {
  const size = Number.isFinite(sizeProp) && sizeProp > 0 ? sizeProp : 132;
  const enc = encodeByteMode((value ?? "").trim());
  if (!enc) return null;
  const total = enc.size + quietZone * 2;
  const cell = total > 0 && Number.isFinite(size / total) ? size / total : 4;
  const rects: React.ReactNode[] = [];
  for (let r = 0; r < enc.size; r++) for (let c = 0; c < enc.size; c++) {
    if (enc.matrix[r][c]) {
      rects.push(
        <rect key={`${r}-${c}`} x={(c + quietZone) * cell} y={(r + quietZone) * cell} width={cell + 0.5} height={cell + 0.5} fill="#000" />,
      );
    }
  }
  return (
    <svg className={className} width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`QR code ${value}`} style={{ maxWidth: "100%" }}>
      <rect x={0} y={0} width={size} height={size} fill="#fff" />
      {rects}
    </svg>
  );
}


"use client";

/**
 * Dependency-free, CSP-safe QR Code renderer — pure inline SVG, no canvas, no
 * external library. Byte mode, error-correction level M, mask 0, single data
 * block (versions 1–4, ≈ 62 bytes) which covers product codes, SKUs, HS codes
 * and short URLs. A single block keeps the interleave provably correct — see the
 * exact round-trip in scratch/qr-selftest.mts. Values that don't fit fall back to
 * the 1D Code128 <Barcode>.
 */

// ── Galois field GF(256), primitive poly 0x11d ─────────────────────────────
const EXP: number[] = new Array(512);
const LOG: number[] = new Array(256);
(() => {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    EXP[i] = x;
    LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
})();
const gfMul = (a: number, b: number) => (a === 0 || b === 0 ? 0 : EXP[LOG[a] + LOG[b]]);

function rsGenPoly(deg: number): number[] {
  let poly = [1];
  for (let i = 0; i < deg; i++) {
    const next = new Array(poly.length + 1).fill(0);
    for (let j = 0; j < poly.length; j++) {
      next[j] ^= gfMul(poly[j], EXP[i]);
      next[j + 1] ^= poly[j];
    }
    poly = next;
  }
  return poly;
}
function rsEncode(data: number[], ecLen: number): number[] {
  const gen = rsGenPoly(ecLen);
  const res = new Array(ecLen).fill(0);
  for (const d of data) {
    const factor = d ^ res[0];
    res.shift();
    res.push(0);
    for (let i = 0; i < ecLen; i++) res[i] ^= gfMul(gen[i], factor);
  }
  return res;
}

type VerInfo = { ver: number; dataCw: number; ecCw: number };
const VER_M: VerInfo[] = [
  { ver: 1, dataCw: 16, ecCw: 10 },
  { ver: 2, dataCw: 28, ecCw: 16 },
  { ver: 3, dataCw: 44, ecCw: 26 },
  { ver: 4, dataCw: 64, ecCw: 18 },
];
const ALIGN_POS: Record<number, number[]> = { 1: [], 2: [6, 18], 3: [6, 22], 4: [6, 26] };

// EC level M format string (indicator 00) with mask 0, BCH(15,5) + mask pattern 0x5412
function formatInfoBits(): number {
  const data = 0b00_000; // EC M (00) + mask 0 (000)
  let rem = data << 10;
  for (let i = 14; i >= 10; i--) if ((rem >> i) & 1) rem ^= 0x537 << (i - 10);
  return ((data << 10) | rem) ^ 0x5412;
}

function isFunctionModule(r: number, c: number, size: number, ver: number): boolean {
  // finder + separators (top-left, top-right, bottom-left)
  if (r <= 8 && c <= 8) return true;
  if (r <= 8 && c >= size - 8) return true;
  if (r >= size - 8 && c <= 8) return true;
  // timing
  if (r === 6 || c === 6) return true;
  // alignment
  const aps = ALIGN_POS[ver];
  for (const ar of aps) for (const ac of aps) {
    if ((ar <= 8 && ac <= 8) || (ar <= 8 && ac >= size - 9) || (ar >= size - 9 && ac <= 8)) continue;
    if (Math.abs(r - ar) <= 2 && Math.abs(c - ac) <= 2) return true;
  }
  return false;
}

export function encodeByteMode(text: string): { matrix: boolean[][]; size: number } | null {
  if (!text) return null;
  const bytes = Array.from(new TextEncoder().encode(text));
  if (bytes.length === 0) return null;
  const info = VER_M.find((v) => Math.ceil((4 + 8 + bytes.length * 8) / 8) <= v.dataCw);
  if (!info) return null;
  const { ver, dataCw, ecCw } = info;
  const size = 17 + ver * 4;

  // ── bit stream ──
  const bits: number[] = [];
  const push = (val: number, len: number) => {
    for (let i = len - 1; i >= 0; i--) bits.push((val >> i) & 1);
  };
  push(0b0100, 4); // byte mode
  push(bytes.length, 8); // char count (8 bits for v1-9)
  for (const b of bytes) push(b, 8);
  const cap = dataCw * 8;
  for (let i = 0; i < Math.min(4, cap - bits.length); i++) bits.push(0); // terminator
  while (bits.length % 8 !== 0) bits.push(0);
  const pad = [0xec, 0x11];
  let pi = 0;
  while (bits.length < cap) push(pad[pi++ % 2], 8);

  const data: number[] = [];
  for (let i = 0; i < bits.length; i += 8) {
    let b = 0;
    for (let j = 0; j < 8; j++) b = (b << 1) | bits[i + j];
    data.push(b);
  }
  const ec = rsEncode(data, ecCw);
  const allCw = [...data, ...ec];
  const dataBits: number[] = [];
  for (const cw of allCw) for (let i = 7; i >= 0; i--) dataBits.push((cw >> i) & 1);

  // ── matrix ──
  const m: boolean[][] = Array.from({ length: size }, () => new Array(size).fill(false));

  const drawFinder = (r: number, c: number) => {
    for (let i = -1; i <= 7; i++) for (let j = -1; j <= 7; j++) {
      const rr = r + i, cc = c + j;
      if (rr < 0 || rr >= size || cc < 0 || cc >= size) continue;
      const ring = i >= 0 && i <= 6 && j >= 0 && j <= 6;
      m[rr][cc] = ring && (i === 0 || i === 6 || j === 0 || j === 6 || (i >= 2 && i <= 4 && j >= 2 && j <= 4));
    }
  };
  drawFinder(0, 0);
  drawFinder(0, size - 7);
  drawFinder(size - 7, 0);

  // timing
  for (let i = 8; i < size - 8; i++) {
    m[6][i] = i % 2 === 0;
    m[i][6] = i % 2 === 0;
  }
  // dark module
  m[size - 8][8] = true;

  // alignment
  for (const ar of ALIGN_POS[ver]) for (const ac of ALIGN_POS[ver]) {
    if ((ar <= 8 && ac <= 8) || (ar <= 8 && ac >= size - 9) || (ar >= size - 9 && ac <= 8)) continue;
    for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) {
      m[ar + i][ac + j] = Math.max(Math.abs(i), Math.abs(j)) !== 1;
    }
  }

  // data placement (zigzag from bottom-right), skipping function modules + col 6
  let bit = 0;
  let upward = true;
  for (let col = size - 1; col > 0; col -= 2) {
    if (col === 6) col = 5;
    for (let k = 0; k < size; k++) {
      const row = upward ? size - 1 - k : k;
      for (let c = 0; c < 2; c++) {
        const cc = col - c;
        if (isFunctionModule(row, cc, size, ver)) continue;
        let v = bit < dataBits.length ? dataBits[bit++] === 1 : false;
        if ((row + cc) % 2 === 0) v = !v; // mask 0
        m[row][cc] = v;
      }
    }
    upward = !upward;
  }

  // ── format info (EC M + mask 0) ──
  const fmt = formatInfoBits();
  const fbit = (i: number) => ((fmt >> i) & 1) === 1;
  // copy 1 — around top-left finder
  for (let i = 0; i <= 5; i++) m[8][i] = fbit(i);
  m[8][7] = fbit(6);
  m[8][8] = fbit(7);
  m[7][8] = fbit(8);
  for (let i = 9; i <= 14; i++) m[14 - i][8] = fbit(i);
  // copy 2 — split: bits 0..6 vertical bottom-left, bits 7..14 horizontal top-right
  for (let i = 0; i <= 6; i++) m[size - 1 - i][8] = fbit(i);
  for (let i = 7; i <= 14; i++) m[8][size - 15 + i] = fbit(i);
  // restore the always-dark module (overwritten by the loop above)
  m[size - 8][8] = true;

  return { matrix: m, size };
}

/**
 * Round-trip reader for our own encodeByteMode output (mask 0, EC-M, single block).
 * Used only by the self-test to prove data placement/masking are consistent.
 */
export function decodeQrByteMode(matrix: boolean[][], size: number): string | null {
  const ver = (size - 17) / 4;
  if (!VER_M.some((v) => v.ver === ver)) return null;
  const bits: number[] = [];
  let upward = true;
  for (let col = size - 1; col > 0; col -= 2) {
    if (col === 6) col = 5;
    for (let k = 0; k < size; k++) {
      const row = upward ? size - 1 - k : k;
      for (let c = 0; c < 2; c++) {
        const cc = col - c;
        if (isFunctionModule(row, cc, size, ver)) continue;
        let v = matrix[row][cc];
        if ((row + cc) % 2 === 0) v = !v;
        bits.push(v ? 1 : 0);
      }
    }
    upward = !upward;
  }
  let bp = 0;
  const take = (n: number) => {
    let v = 0;
    for (let i = 0; i < n; i++) v = (v << 1) | (bits[bp++] || 0);
    return v;
  };
  if (take(4) !== 0b0100) return null;
  const len = take(8);
  const out: number[] = [];
  for (let i = 0; i < len; i++) out.push(take(8));
  return new TextDecoder().decode(new Uint8Array(out));
}

// ── renderers ──────────────────────────────────────────────────────────────
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

export function qrCodeSvgMarkup(value: string, opts?: { size?: number; quietZone?: number }): string {
  const size = opts?.size ?? 132;
  const quietZone = opts?.quietZone ?? 4;
  const enc = encodeByteMode((value ?? "").trim());
  if (!enc) return "";
  const total = enc.size + quietZone * 2;
  const cell = size / total;
  let rects = "";
  for (let r = 0; r < enc.size; r++) for (let c = 0; c < enc.size; c++) {
    if (enc.matrix[r][c]) {
      rects += `<rect x="${((c + quietZone) * cell).toFixed(2)}" y="${((r + quietZone) * cell).toFixed(2)}" width="${(cell + 0.5).toFixed(2)}" height="${(cell + 0.5).toFixed(2)}" fill="#000"/>`;
    }
  }
  const esc = (s: string) => s.replace(/[<>&"]/g, (mm) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[mm] as string));
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" role="img" aria-label="QR code ${esc(value)}"><rect x="0" y="0" width="${size}" height="${size}" fill="#fff"/>${rects}</svg>`;
}

/**
 * Voice message audio — PRIVATE local storage.
 *
 * Audio blobs live under ./storage/voice-messages/<yyyy>/<mm>/<jobId>.<ext> —
 * NOT inside public/, never served statically. Streamed back only through an
 * authenticated, scope-checked API route. Mirrors lib/document-intelligence/storage.ts.
 */
import fs from "node:fs/promises";
import path from "node:path";

const ROOT = path.join(process.cwd(), "storage", "voice-messages");

export const MAX_AUDIO_BYTES = Number(process.env.VOICE_MAX_BYTES || 30 * 1024 * 1024); // 30 MB

const AUDIO_MAGIC: Array<{ ext: string; mime: string; test: (b: Buffer) => boolean }> = [
  // WebM / Matroska (MediaRecorder default on Chrome/Firefox)
  { ext: "webm", mime: "audio/webm", test: (b) => b.subarray(0, 4).toString("hex") === "1a45dfa3" },
  // OGG (Firefox alt)
  { ext: "ogg", mime: "audio/ogg", test: (b) => b.subarray(0, 4).toString("latin1") === "OggS" },
  // MP4 / M4A (Safari MediaRecorder)
  { ext: "m4a", mime: "audio/mp4", test: (b) => b.subarray(4, 8).toString("latin1") === "ftyp" },
  // WAV
  { ext: "wav", mime: "audio/wav", test: (b) => b.subarray(0, 4).toString("latin1") === "RIFF" && b.subarray(8, 12).toString("latin1") === "WAVE" },
  // MP3
  { ext: "mp3", mime: "audio/mpeg", test: (b) => (b[0] === 0xff && (b[1] & 0xe0) === 0xe0) || b.subarray(0, 3).toString("latin1") === "ID3" },
];

export type ValidatedAudio = { buffer: Buffer; ext: string; mime: string; size: number };

export function validateAudio(buffer: Buffer, declaredMime?: string | null): ValidatedAudio {
  if (!buffer?.length) throw new Error("Empty audio file.");
  if (buffer.length > MAX_AUDIO_BYTES) {
    throw new Error(`Audio is larger than the ${(MAX_AUDIO_BYTES / 1024 / 1024).toFixed(0)} MB limit.`);
  }
  const hit =
    AUDIO_MAGIC.find((a) => a.test(buffer)) ||
    AUDIO_MAGIC.find((a) => declaredMime && declaredMime.toLowerCase().includes(a.ext));
  if (!hit) {
    throw new Error("Unsupported audio format. Allowed: WebM, OGG, M4A/MP4, WAV, MP3.");
  }
  return { buffer, ext: hit.ext, mime: hit.mime, size: buffer.length };
}

function keyFor(jobId: string, ext: string): string {
  const d = new Date();
  return `${d.getUTCFullYear()}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${jobId}.${ext}`;
}

export async function saveVoiceAudio(jobId: string, audio: ValidatedAudio): Promise<string> {
  const storageKey = keyFor(jobId, audio.ext);
  const abs = path.join(ROOT, storageKey);
  await fs.mkdir(path.dirname(abs), { recursive: true });
  await fs.writeFile(abs, audio.buffer, { mode: 0o600 });
  return storageKey;
}

export async function readVoiceAudio(storageKey: string): Promise<{ buffer: Buffer; mime: string }> {
  const safe = storageKey.replace(/\\/g, "/").replace(/^\/+/, "").replace(/\.\.(\/|$)/g, "");
  const abs = path.join(ROOT, safe);
  if (!abs.startsWith(ROOT)) throw new Error("Invalid storage key.");
  const buffer = await fs.readFile(abs);
  const ext = (safe.split(".").pop() || "webm").toLowerCase();
  const mime = AUDIO_MAGIC.find((a) => a.ext === ext)?.mime || "application/octet-stream";
  return { buffer, mime };
}

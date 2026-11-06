/** Convert the operator's local wall-clock entry to UTC. Existing clients without an offset retain UTC semantics. */
export function dailyRateEffectiveFrom(date: string, time: string | null | undefined, offsetMinutes?: number | null): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("Invalid rate date.");
  const offset = offsetMinutes ?? 0;
  if (!Number.isInteger(offset) || Math.abs(offset) > 840) throw new Error("Invalid time zone offset.");
  const match = String(time || "").trim().match(/^(\d{1,2}):(\d{2})\s*([AaPp][Mm])?$/);
  if (!match) {
    if (time) throw new Error("Invalid rate time.");
    return new Date().toISOString();
  }
  let hour = Number(match[1]);
  const minute = Number(match[2]);
  const ap = match[3]?.toUpperCase();
  if (minute > 59 || (ap ? hour < 1 || hour > 12 : hour > 23)) throw new Error("Invalid rate time.");
  if (ap === "PM" && hour < 12) hour += 12;
  if (ap === "AM" && hour === 12) hour = 0;
  const utc = Date.parse(`${date}T${String(hour).padStart(2, "0")}:${match[2]}:00Z`);
  if (!Number.isFinite(utc) || new Date(utc).toISOString().slice(0, 10) !== date) throw new Error("Invalid rate date.");
  return new Date(utc + offset * 60_000).toISOString();
}

export const TZ = "America/Chicago";

function offsetMinutes(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUTC = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return (asUTC - date.getTime()) / 60000;
}

/** "2026-10-12T09:00" entered in Central time -> ISO string (UTC). */
export function localToISO(local: string, timeZone = TZ): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(local);
  if (!m) return null;
  const guess = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]));
  const off = offsetMinutes(guess, timeZone);
  const result = new Date(guess.getTime() - off * 60000);
  // Re-check across DST boundaries
  const off2 = offsetMinutes(result, timeZone);
  return off2 === off ? result.toISOString() : new Date(guess.getTime() - off2 * 60000).toISOString();
}

/** ISO -> "YYYY-MM-DDTHH:mm" in Central time, for datetime-local inputs. */
export function isoToLocal(iso: string | null | undefined, timeZone = TZ): string {
  if (!iso) return "";
  const d = new Date(iso);
  const p = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(d);
  const g = (t: string) => p.find((x) => x.type === t)?.value;
  return `${g("year")}-${g("month")}-${g("day")}T${g("hour")}:${g("minute")}`;
}

/** Start and end of "today" in Central time, as ISO strings. */
export function todayRange(timeZone = TZ) {
  const day = isoToLocal(new Date().toISOString(), timeZone).slice(0, 10);
  const start = localToISO(`${day}T00:00`, timeZone)!;
  const end = new Date(new Date(localToISO(`${day}T23:59`, timeZone)!).getTime() + 60000).toISOString();
  return { start, end };
}

const fmt = (opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("en-US", { timeZone: TZ, ...opts });

export const formatDateTime = (iso: string) =>
  fmt({ weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(iso));
export const formatTime = (iso: string) => fmt({ hour: "numeric", minute: "2-digit" }).format(new Date(iso));
export const formatDate = (iso: string) => fmt({ month: "short", day: "numeric", year: "numeric" }).format(new Date(iso));

export function relativeDay(iso: string) {
  const day = isoToLocal(iso).slice(0, 10);
  const today = isoToLocal(new Date().toISOString()).slice(0, 10);
  const diff = Math.round((Date.parse(day) - Date.parse(today)) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  if (diff < 0) return `${-diff} days ago`;
  return `In ${diff} days`;
}

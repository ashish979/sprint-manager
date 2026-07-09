/** Timezone math via Intl — no dependencies, DST-correct. */

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export interface LocalParts {
  /** Local calendar date yyyy-mm-dd. */
  date: string;
  /** 0 = Sunday … 6 = Saturday. */
  weekday: number;
  /** Minutes since local midnight. */
  minutes: number;
}

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timeZone: string): Intl.DateTimeFormat {
  let fmt = formatters.get(timeZone);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    });
    formatters.set(timeZone, fmt);
  }
  return fmt;
}

/** Project an instant into a timezone's local calendar. */
export function localParts(instant: Date, timeZone: string): LocalParts {
  const parts = formatterFor(timeZone).formatToParts(instant);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? "";
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    weekday: WEEKDAYS.indexOf(get("weekday")),
    minutes: Number(get("hour")) * 60 + Number(get("minute")),
  };
}

/** "09:15" → 555. Returns NaN for malformed input. */
export function timeToMinutes(time: string): number {
  const match = /^(\d{1,2}):(\d{2})$/.exec(time);
  if (!match) return NaN;
  return Number(match[1]) * 60 + Number(match[2]);
}

/** "09:15" → "9:15 AM", "19:00" → "7:00 PM". Returns the input unchanged if malformed. */
export function formatTime12h(time: string): string {
  const minutes = timeToMinutes(time);
  if (Number.isNaN(minutes)) return time;
  const period = minutes < 12 * 60 ? "AM" : "PM";
  const hour24 = Math.floor(minutes / 60);
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  const mins = String(minutes % 60).padStart(2, "0");
  return `${hour12}:${mins} ${period}`;
}

/** Human date for messages: "2026-07-08" → "Wed, Jul 8". */
export function friendlyDate(date: string): string {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00Z`));
}

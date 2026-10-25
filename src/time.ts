/**
 * Minimal time-zone helpers built on Intl, so we don't need a date library.
 */

export interface LocalParts {
    year: number;
    month: number; // 1-12
    day: number;
    hour: number;
    minute: number;
}

export function toLocalParts(date: Date, timeZone: string): LocalParts {
    const parts = new Intl.DateTimeFormat("en-GB", {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
    }).formatToParts(date);
    const get = (type: string) =>
        Number(parts.find((p) => p.type === type)?.value);
    return {
        year: get("year"),
        month: get("month"),
        day: get("day"),
        hour: get("hour"),
        minute: get("minute"),
    };
}

/** Offset (ms) of the zone from UTC at the given instant. */
function offsetMs(date: Date, timeZone: string): number {
    const p = toLocalParts(date, timeZone);
    const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);
    const truncated = Math.floor(date.getTime() / 60000) * 60000;
    return asUtc - truncated;
}

/** The UTC instant at which the wall clock in `timeZone` shows the given time. */
export function zonedToUtc(
    year: number,
    month: number,
    day: number,
    hour: number,
    minute: number,
    timeZone: string,
): Date {
    const guess = Date.UTC(year, month - 1, day, hour, minute);
    let result = guess - offsetMs(new Date(guess), timeZone);
    // Second pass handles the case where the first guess crossed a DST switch.
    result = guess - offsetMs(new Date(result), timeZone);
    return new Date(result);
}

/** Add whole calendar days to a y/m/d (handles month/year rollover). */
export function addDays(
    year: number,
    month: number,
    day: number,
    days: number,
): { year: number; month: number; day: number } {
    const d = new Date(Date.UTC(year, month - 1, day + days));
    return {
        year: d.getUTCFullYear(),
        month: d.getUTCMonth() + 1,
        day: d.getUTCDate(),
    };
}

export function formatLocal(date: Date, timeZone: string): string {
    return new Intl.DateTimeFormat("en-GB", {
        timeZone,
        weekday: "short",
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
    }).format(date);
}

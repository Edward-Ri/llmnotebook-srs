import type { Request } from "express";

const OFFSET_MIN = -14 * 60;
const OFFSET_MAX = 14 * 60;

function parseOffsetValue(raw: unknown): number | null {
  if (typeof raw !== "string" || raw.trim().length === 0) return null;
  const parsed = Number.parseInt(raw, 10);
  if (Number.isNaN(parsed)) return null;
  if (parsed < OFFSET_MIN || parsed > OFFSET_MAX) return null;
  return parsed;
}

export function resolveTzOffsetMinutes(req: Request): number {
  const queryValue = Array.isArray(req.query.tzOffsetMinutes)
    ? req.query.tzOffsetMinutes[0]
    : req.query.tzOffsetMinutes;
  const headerValue = Array.isArray(req.headers["x-tz-offset-minutes"])
    ? req.headers["x-tz-offset-minutes"][0]
    : req.headers["x-tz-offset-minutes"];

  const fromQuery = parseOffsetValue(queryValue);
  if (fromQuery !== null) return fromQuery;

  const fromHeader = parseOffsetValue(headerValue);
  if (fromHeader !== null) return fromHeader;

  return new Date().getTimezoneOffset();
}

export function getLocalDayBounds(reference: Date, tzOffsetMinutes: number) {
  const offsetMs = tzOffsetMinutes * 60 * 1000;
  const shifted = new Date(reference.getTime() - offsetMs);
  const shiftedMidnightUtcMs = Date.UTC(
    shifted.getUTCFullYear(),
    shifted.getUTCMonth(),
    shifted.getUTCDate(),
  );
  const dayStartUtc = new Date(shiftedMidnightUtcMs + offsetMs);
  const nextDayStartUtc = new Date(dayStartUtc.getTime() + 24 * 60 * 60 * 1000);

  return { dayStartUtc, nextDayStartUtc };
}

export function toLocalDateKey(date: Date, tzOffsetMinutes: number): string {
  const localDate = new Date(date.getTime() - tzOffsetMinutes * 60 * 1000);
  return localDate.toISOString().slice(0, 10);
}

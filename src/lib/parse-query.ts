/**
 * Safe pagination query param parsers — guard against NaN when clients
 * send non-numeric values (e.g. "abc", "", undefined).
 */

export function parsePage(val: string | null, fallback = 1): number {
  return Math.max(1, parseInt(val ?? String(fallback), 10) || fallback);
}

export function parseLimit(val: string | null, fallback = 10, max = 200): number {
  return Math.min(max, Math.max(1, parseInt(val ?? String(fallback), 10) || fallback));
}

export function parseIntParam(val: string | null, fallback: number): number {
  return parseInt(val ?? String(fallback), 10) || fallback;
}

/**
 * Date formatting and release countdown utilities for TrackUp
 */

/**
 * Formats a date string (e.g. "2026-10-17" or ISO string) to a human-readable format:
 * e.g. "Oct 17, 2026"
 */
export function formatReleaseDate(
  dateStr: string | null | undefined,
  options?: Intl.DateTimeFormatOptions
): string | null {
  if (!dateStr || typeof dateStr !== 'string') return null;

  // Handle YYYY-MM-DD or full ISO strings
  const parts = dateStr.split('T')[0].split('-');
  let date: Date;
  if (parts.length === 3) {
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    date = new Date(year, month, day);
  } else {
    date = new Date(dateStr);
  }

  if (isNaN(date.getTime())) return null;

  const defaultOptions: Intl.DateTimeFormatOptions = {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  };

  return date.toLocaleDateString('en-US', options || defaultOptions);
}

/**
 * Calculates countdown until an air date.
 * If the date is in the future, returns a string like "5 days" or "12 days".
 * If the date is today, returns "Airing Today".
 * If the date is in the past, returns null.
 */
export function getAirDateCountdown(
  airDateStr: string | null | undefined,
  referenceDate: Date = new Date()
): string | null {
  if (!airDateStr || typeof airDateStr !== 'string') return null;

  const parts = airDateStr.split('T')[0].split('-');
  let targetYear: number;
  let targetMonth: number;
  let targetDay: number;

  if (parts.length === 3) {
    targetYear = parseInt(parts[0], 10);
    targetMonth = parseInt(parts[1], 10) - 1;
    targetDay = parseInt(parts[2], 10);
  } else {
    const d = new Date(airDateStr);
    if (isNaN(d.getTime())) return null;
    targetYear = d.getUTCFullYear();
    targetMonth = d.getUTCMonth();
    targetDay = d.getUTCDate();
  }

  // Normalized UTC midnights to accurately calculate calendar days difference
  const targetUtc = Date.UTC(targetYear, targetMonth, targetDay);
  const refUtc = Date.UTC(
    referenceDate.getUTCFullYear(),
    referenceDate.getUTCMonth(),
    referenceDate.getUTCDate()
  );

  const diffMs = targetUtc - refUtc;
  if (diffMs < 0) return null; // already aired in past

  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays <= 0) return 'Today';
  if (diffDays === 1) return '1 day';
  return `${diffDays} days`;
}

/**
 * Checks if a date is in the future.
 */
export function isFutureDate(
  dateStr: string | null | undefined,
  referenceDate: Date = new Date()
): boolean {
  return getAirDateCountdown(dateStr, referenceDate) !== null;
}

/**
 * Formats a duration in minutes into a clean hours & minutes string (e.g. 135 -> "2h 15m", 90 -> "1h 30m", 45 -> "45m").
 */
export function formatRuntime(minutes: number | null | undefined): string | null {
  if (minutes === null || minutes === undefined || isNaN(minutes) || minutes <= 0) return null;
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  if (hours > 0 && mins > 0) return `${hours}h ${mins}m`;
  if (hours > 0) return `${hours}h`;
  return `${mins}m`;
}

/**
 * Formats aggregated watch time into Months and Days for TV Time-style statistics.
 * Uses a standard 30-day month (months = Math.floor(totalDays / 30)).
 * Example: "2 Months, 5 Days" (omits months if 0).
 */
export function formatWatchTime(minutes: number | null | undefined): string {
  if (!minutes || isNaN(minutes) || minutes <= 0) return '0 Days';
  const totalMins = Math.round(minutes);
  const totalDays = Math.floor(totalMins / 1440);
  const months = Math.floor(totalDays / 30);
  const days = totalDays % 30;

  if (months > 0) {
    const monthPart = `${months} ${months === 1 ? 'Month' : 'Months'}`;
    if (days > 0) {
      return `${monthPart}, ${days} ${days === 1 ? 'Day' : 'Days'}`;
    }
    return monthPart;
  }

  // Omit months if 0
  const displayDays = totalDays === 0 && totalMins > 0 ? 1 : days;
  return `${displayDays} ${displayDays === 1 ? 'Day' : 'Days'}`;
}

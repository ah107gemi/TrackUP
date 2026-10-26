import { describe, it, expect } from 'vitest';
import { formatReleaseDate, getAirDateCountdown, isFutureDate } from '../../src/lib/dateUtils';

describe('Date Utilities & Air Date Countdowns', () => {
  describe('formatReleaseDate', () => {
    it('formats YYYY-MM-DD correctly to "MMM D, YYYY"', () => {
      expect(formatReleaseDate('2026-10-17')).toBe('Oct 17, 2026');
      expect(formatReleaseDate('2010-07-16')).toBe('Jul 16, 2010');
    });

    it('returns null for empty, null, or invalid dates', () => {
      expect(formatReleaseDate(null)).toBeNull();
      expect(formatReleaseDate(undefined)).toBeNull();
      expect(formatReleaseDate('not-a-date')).toBeNull();
    });
  });

  describe('getAirDateCountdown', () => {
    it('returns null for past dates', () => {
      const ref = new Date('2026-10-26T12:00:00Z');
      expect(getAirDateCountdown('2026-10-20', ref)).toBeNull();
      expect(getAirDateCountdown('2013-04-07', ref)).toBeNull();
    });

    it('returns correct day countdown for future dates', () => {
      const ref = new Date('2026-10-26T12:00:00Z');
      // 5 days ahead
      expect(getAirDateCountdown('2026-10-31', ref)).toBe('5 days');
      // 12 days ahead
      expect(getAirDateCountdown('2026-11-07', ref)).toBe('12 days');
      // 1 day ahead
      expect(getAirDateCountdown('2026-10-27', ref)).toBe('1 day');
      // Today
      expect(getAirDateCountdown('2026-10-26', ref)).toBe('Today');
    });

    it('identifies future dates correctly with isFutureDate', () => {
      const ref = new Date('2026-10-26T12:00:00Z');
      expect(isFutureDate('2026-11-10', ref)).toBe(true);
      expect(isFutureDate('2026-10-20', ref)).toBe(false);
    });
  });
});

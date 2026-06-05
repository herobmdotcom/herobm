import {
  resolveDateRangeFilter,
  DateRangeConfig,
  getAggregationPeriod,
} from './date-range.util';

describe('resolveDateRangeFilter', () => {
  // Reference date: June 15, 2026
  const refDate = new Date(2026, 5, 15); // Month is 0-indexed (5 = June)

  it('should return absolute dates directly', () => {
    const config: DateRangeConfig = {
      mode: 'absolute',
      from: '2026-01-01',
      to: '2026-12-31',
    };
    const result = resolveDateRangeFilter(config, refDate);
    expect(result).toEqual({ fromDate: '2026-01-01', toDate: '2026-12-31' });
  });

  describe('days', () => {
    it('should resolve last 7 days (including today)', () => {
      const config: DateRangeConfig = {
        mode: 'relative',
        unit: 'days',
        n: 7,
        fullCalendar: false,
      };
      const result = resolveDateRangeFilter(config, refDate);
      expect(result).toEqual({
        fromDate: '2026-06-08',
        toDate: '2026-06-15',
      });
    });

    it('should resolve last 7 days (full calendar - excluding today)', () => {
      const config: DateRangeConfig = {
        mode: 'relative',
        unit: 'days',
        n: 7,
        fullCalendar: true,
      };
      const result = resolveDateRangeFilter(config, refDate);
      expect(result).toEqual({
        fromDate: '2026-06-08', // 14, 13, 12, 11, 10, 9, 8
        toDate: '2026-06-14',
      });
    });
  });

  describe('months', () => {
    it('should resolve last 3 months (including today)', () => {
      const config: DateRangeConfig = {
        mode: 'relative',
        unit: 'months',
        n: 3,
        fullCalendar: false,
      };
      const result = resolveDateRangeFilter(config, refDate);
      expect(result).toEqual({
        fromDate: '2026-03-15',
        toDate: '2026-06-15',
      });
    });

    it('should resolve last 3 months (full calendar - Jan/Feb leap year aware)', () => {
      // Leap year 2024, Ref Date: March 15, 2024
      const leapRef = new Date(2024, 2, 15);
      const config: DateRangeConfig = {
        mode: 'relative',
        unit: 'months',
        n: 2,
        fullCalendar: true,
      };
      const result = resolveDateRangeFilter(config, leapRef);
      expect(result).toEqual({
        fromDate: '2024-01-01',
        toDate: '2024-02-29', // Leap year Feb ends on 29
      });
    });

    it('should resolve last 1 month (full calendar)', () => {
      const config: DateRangeConfig = {
        mode: 'relative',
        unit: 'months',
        n: 1,
        fullCalendar: true,
      };
      const result = resolveDateRangeFilter(config, refDate);
      // ref is June 15. Previous month is May.
      expect(result).toEqual({
        fromDate: '2026-05-01',
        toDate: '2026-05-31',
      });
    });
  });

  describe('years', () => {
    it('should resolve last 2 years (including today)', () => {
      const config: DateRangeConfig = {
        mode: 'relative',
        unit: 'years',
        n: 2,
        fullCalendar: false,
      };
      const result = resolveDateRangeFilter(config, refDate);
      expect(result).toEqual({
        fromDate: '2024-06-15',
        toDate: '2026-06-15',
      });
    });

    it('should resolve last 1 year (full calendar)', () => {
      const config: DateRangeConfig = {
        mode: 'relative',
        unit: 'years',
        n: 1,
        fullCalendar: true,
      };
      const result = resolveDateRangeFilter(config, refDate);
      expect(result).toEqual({
        fromDate: '2025-01-01',
        toDate: '2025-12-31',
      });
    });
  });
});

describe('getAggregationPeriod', () => {
  it('should return month if dates are not provided', () => {
    expect(getAggregationPeriod({})).toBe('month');
  });

  it('should return day for 31 days or less', () => {
    expect(
      getAggregationPeriod({ fromDate: '2026-01-01', toDate: '2026-01-31' }),
    ).toBe('day'); // 30 days diff
    expect(
      getAggregationPeriod({ fromDate: '2026-01-01', toDate: '2026-02-01' }),
    ).toBe('day'); // 31 days diff
  });

  it('should return week for up to 180 days', () => {
    expect(
      getAggregationPeriod({ fromDate: '2026-01-01', toDate: '2026-02-02' }),
    ).toBe('week'); // 32 days diff
    expect(
      getAggregationPeriod({ fromDate: '2026-01-01', toDate: '2026-06-30' }),
    ).toBe('week'); // 180 days diff
  });

  it('should return month for over 180 days', () => {
    expect(
      getAggregationPeriod({ fromDate: '2026-01-01', toDate: '2026-07-01' }),
    ).toBe('month'); // 181 days diff
  });
});

import { sql } from 'drizzle-orm';

export type DateRangeUnit = 'days' | 'months' | 'years';

export interface RelativeDateRangeConfig {
  mode: 'relative';
  n: number;
  unit: DateRangeUnit;
  fullCalendar: boolean;
}

export interface AbsoluteDateRangeConfig {
  mode: 'absolute';
  from?: string;
  to?: string;
}

export type DateRangeConfig = RelativeDateRangeConfig | AbsoluteDateRangeConfig;

export function resolveDateRangeFilter(
  config: DateRangeConfig,
  referenceDate: Date = new Date(),
): { fromDate?: string; toDate?: string } {
  if (config.mode === 'absolute') {
    return {
      fromDate: config.from,
      toDate: config.to,
    };
  }

  const { n, unit, fullCalendar } = config;

  // Clone reference date to avoid mutation
  const ref = new Date(referenceDate);
  ref.setHours(0, 0, 0, 0);

  let fromDate: Date;
  let toDate: Date;

  if (unit === 'days') {
    if (fullCalendar) {
      // Last N full days (excluding today)
      toDate = new Date(ref);
      toDate.setDate(ref.getDate() - 1);

      fromDate = new Date(toDate);
      fromDate.setDate(toDate.getDate() - n + 1);
    } else {
      // Last N days including today
      toDate = new Date(ref);

      fromDate = new Date(ref);
      fromDate.setDate(ref.getDate() - n);
    }
  } else if (unit === 'months') {
    if (fullCalendar) {
      // End of previous month
      toDate = new Date(ref.getFullYear(), ref.getMonth(), 0);

      // Start of N months before the previous month
      fromDate = new Date(ref.getFullYear(), ref.getMonth() - n, 1);
    } else {
      // Today is the end date
      toDate = new Date(ref);

      // N months ago from today
      fromDate = new Date(ref);
      fromDate.setMonth(ref.getMonth() - n);
    }
  } else if (unit === 'years') {
    if (fullCalendar) {
      // End of previous year
      toDate = new Date(ref.getFullYear() - 1, 11, 31);

      // Start of N years before the previous year
      fromDate = new Date(ref.getFullYear() - n, 0, 1);
    } else {
      toDate = new Date(ref);

      fromDate = new Date(ref);
      fromDate.setFullYear(ref.getFullYear() - n);
    }
  } else {
    throw new Error('Unsupported date range unit');
  }

  // Format as YYYY-MM-DD
  const format = (d: Date) => {
    const pad = (num: number) => num.toString().padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  };

  return {
    fromDate: format(fromDate),
    toDate: format(toDate),
  };
}

export function getAggregationPeriod(
  filters: Record<string, unknown>,
): 'day' | 'week' | 'month' {
  if (filters.fromDate && filters.toDate) {
    const from = new Date(filters.fromDate as string);
    const to = new Date(filters.toDate as string);
    const diffDays = Math.ceil(
      (to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24),
    );

    if (diffDays <= 31) return 'day';
    if (diffDays <= 180) return 'week';
  }
  return 'month';
}

export function getAggregationSql(
  dateField: any,
  period: 'day' | 'week' | 'month',
) {
  if (period === 'day') return sql<string>`to_char(${dateField}, 'YYYY-MM-DD')`;
  if (period === 'week')
    return sql<string>`to_char(${dateField}, 'IYYY-"W"IW')`;
  return sql<string>`to_char(${dateField}, 'YYYY-MM')`;
}

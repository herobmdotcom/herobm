import React from 'react';
import { useTranslations } from 'next-intl';

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

interface DateRangeFilterProps {
  value?: DateRangeConfig;
  onChange: (value: DateRangeConfig) => void;
}

export function DateRangeFilter({ value, onChange }: DateRangeFilterProps) {
  const t = useTranslations('reporting.dateRange');
  const config = value || { mode: 'absolute' as const };
  const isRelative = config.mode === 'relative';

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-4">
        <div className="flex bg-[#f2f4f6] rounded-md border border-[rgba(196,198,205,0.4)] p-0.5">
          <button
            className={`px-3 py-0.5 text-xs font-medium rounded-sm transition-colors ${!isRelative ? 'bg-white text-[var(--text-color)] shadow-sm' : 'text-[var(--text-muted)] hover:text-[var(--text-color)]'}`}
            onClick={() => onChange({ mode: 'absolute', from: '', to: '' })}
          >
            {t('fixedDates')}
          </button>
          <button
            className={`px-3 py-0.5 text-xs font-medium rounded-sm transition-colors ${isRelative ? 'bg-white text-[var(--text-color)] shadow-sm' : 'text-[var(--text-muted)] hover:text-[var(--text-color)]'}`}
            onClick={() => onChange({ mode: 'relative', n: 30, unit: 'days', fullCalendar: false })}
          >
            {t('relative')}
          </button>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {config.mode === 'absolute' ? (
          <>
            <input
              type="date"
              className="input max-w-[140px] text-sm"
              placeholder="From"
              value={config.from || ''}
              onChange={(e) => onChange({ ...config, from: e.target.value })}
            />
            <span className="text-[var(--text-muted)] text-sm">-</span>
            <input
              type="date"
              className="input max-w-[140px] text-sm"
              placeholder="To"
              value={config.to || ''}
              onChange={(e) => onChange({ ...config, to: e.target.value })}
            />
          </>
        ) : (
          <div className="flex items-center gap-2">
            <select
              className="input w-[120px] text-sm"
              value={config.fullCalendar ? 'full' : 'latest'}
              onChange={(e) => onChange({ ...config, fullCalendar: e.target.value === 'full' })}
            >
              <option value="latest">{t('latest')}</option>
              <option value="full">{t('lastFull')}</option>
            </select>
            <input
              type="number"
              className="input w-[70px] text-sm"
              min={1}
              value={config.n}
              onChange={(e) => onChange({ ...config, n: parseInt(e.target.value) || 1 })}
            />
            <select
              className="input w-[100px] text-sm"
              value={config.unit}
              onChange={(e) => onChange({ ...config, unit: e.target.value as DateRangeUnit })}
            >
              <option value="days">{t('days')}</option>
              <option value="months">{t('months')}</option>
              <option value="years">{t('years')}</option>
            </select>
          </div>
        )}
      </div>
    </div>
  );
}

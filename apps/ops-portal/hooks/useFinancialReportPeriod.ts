'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import * as api from '@herobm/sdk';
import { reportError } from '@/lib/api';

export type ReportMode = 'fiscal_period' | 'periodic' | 'custom_range' | 'point_in_time';

export interface UseFinancialReportPeriodOptions {
  supportedModes?: ReportMode[];
  defaultMode?: ReportMode;
  defaultPeriodId?: string;
  defaultStartDate?: string;
  defaultEndDate?: string;
  defaultAsOfDate?: string;
}

export interface FinancialPeriodState {
  periods: api.FiscalPeriodResponseDto[];
  selectedPeriodId: string;
  selectedPeriod: api.FiscalPeriodResponseDto | undefined;
  mode: ReportMode;
  startDate: string;
  endDate: string;
  asOfDate: string;
  loadingPeriods: boolean;
  setMode: (mode: ReportMode) => void;
  setPeriodId: (periodId: string) => void;
  setStartDate: (date: string) => void;
  setEndDate: (date: string) => void;
  setAsOfDate: (date: string) => void;
  formattedSubtitle: string;
}

function getDefaultFirstDayOfMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

function getDefaultLastDayOfMonth(): string {
  const d = new Date();
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
}

function getDefaultToday(): string {
  return new Date().toISOString().slice(0, 10);
}

export function useFinancialReportPeriod(
  options: UseFinancialReportPeriodOptions = {},
): FinancialPeriodState {
  const {
    defaultMode = 'fiscal_period',
    defaultPeriodId = '',
    defaultStartDate,
    defaultEndDate,
    defaultAsOfDate,
  } = options;

  const [periods, setPeriods] = useState<api.FiscalPeriodResponseDto[]>([]);
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>(defaultPeriodId);
  const [loadingPeriods, setLoadingPeriods] = useState<boolean>(true);
  const [mode, setModeState] = useState<ReportMode>(defaultMode);

  const [startDate, setStartDate] = useState<string>(
    () => defaultStartDate || getDefaultFirstDayOfMonth(),
  );
  const [endDate, setEndDate] = useState<string>(
    () => defaultEndDate || getDefaultLastDayOfMonth(),
  );
  const [asOfDate, setAsOfDate] = useState<string>(
    () => defaultAsOfDate || getDefaultToday(),
  );

  useEffect(() => {
    let isCurrent = true;
    api
      .glControllerGetFiscalPeriods({})
      .then((res) => {
        if (!isCurrent) return;
        const list = res.data || [];
        setPeriods(list);
        if (list.length > 0) {
          setSelectedPeriodId((prev) => {
            const currentSelected = prev || defaultPeriodId || list[0].periodId;
            const target = list.find((p) => p.periodId === currentSelected) || list[0];
            setStartDate(target.startDate);
            setEndDate(target.endDate);
            setAsOfDate(target.endDate);
            return target.periodId;
          });
        }
      })
      .catch((err) => {
        reportError(err, 'useFinancialReportPeriod.getFiscalPeriods');
      })
      .finally(() => {
        if (isCurrent) setLoadingPeriods(false);
      });

    return () => {
      isCurrent = false;
    };
  }, [defaultPeriodId]);

  const selectedPeriod = useMemo(
    () => periods.find((p) => p.periodId === selectedPeriodId),
    [periods, selectedPeriodId],
  );

  const setPeriodId = useCallback(
    (periodId: string) => {
      setSelectedPeriodId(periodId);
      const target = periods.find((p) => p.periodId === periodId);
      if (target) {
        setStartDate(target.startDate);
        setEndDate(target.endDate);
        setAsOfDate(target.endDate);
      }
    },
    [periods],
  );

  const setMode = useCallback(
    (nextMode: ReportMode) => {
      setModeState(nextMode);
      if (nextMode === 'fiscal_period' && periods.length > 0) {
        const targetId = selectedPeriodId || periods[0].periodId;
        setPeriodId(targetId);
      }
    },
    [periods, selectedPeriodId, setPeriodId],
  );

  const formattedSubtitle = useMemo(() => {
    if (mode === 'fiscal_period' && selectedPeriod) {
      return `${selectedPeriod.periodName} (${startDate} to ${endDate})`;
    }
    if (mode === 'point_in_time') {
      return `As of ${asOfDate}`;
    }
    return `${startDate} to ${endDate}`;
  }, [mode, selectedPeriod, startDate, endDate, asOfDate]);

  return {
    periods,
    selectedPeriodId,
    selectedPeriod,
    mode,
    startDate,
    endDate,
    asOfDate,
    loadingPeriods,
    setMode,
    setPeriodId,
    setStartDate,
    setEndDate,
    setAsOfDate,
    formattedSubtitle,
  };
}

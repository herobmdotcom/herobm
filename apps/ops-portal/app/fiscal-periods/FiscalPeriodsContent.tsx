'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import * as api from '@herobm/sdk';
import { Button } from '@/components/shared/Button';
import EntityHeader from '@/components/shared/EntityHeader';
import { toast } from 'react-hot-toast';
import { getErrorMessage, SystemResource, hasPermission } from '@herobm/shared';
import { useAuth } from '@/components/AuthGate';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';


function getStatusBadge(status: string) {
  switch (status) {
    case 'open':
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-emerald-100 text-emerald-800">
          Open
        </span>
      );
    case 'soft_locked':
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-amber-100 text-amber-800">
          {/* eslint-disable-next-line no-restricted-syntax -- UI Icon */}
          <span className="material-symbols-outlined text-xs mr-1">{'lock_clock'}</span>
          Soft Locked
        </span>
      );
    case 'hard_closed':
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-rose-100 text-rose-800">
          {/* eslint-disable-next-line no-restricted-syntax -- UI Icon */}
          <span className="material-symbols-outlined text-xs mr-1">{'lock'}</span>
          Hard Closed
        </span>
      );
    default:
      return <span>{status}</span>;
  }
}

export default function FiscalPeriodsContent() {
  useDocumentTitle('Fiscal Periods');
  const { permissions } = useAuth();
  const canWrite = hasPermission(permissions, SystemResource.FISCAL_PERIODS, 'write');

  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [periods, setPeriods] = useState<api.FiscalPeriodResponseDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchPeriods = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.glControllerGetFiscalPeriods({
        fiscalYear: selectedYear,
      });
      setPeriods(res.data || []);
    } catch (err: unknown) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [selectedYear]);

  useEffect(() => {
    fetchPeriods();
  }, [fetchPeriods]);

  const handleGeneratePeriods = async () => {
    if (!canWrite) return;
    try {
      setLoading(true);
      const res = await api.glControllerGenerateFiscalPeriods({
        fiscalYear: selectedYear,
      });
      setPeriods(res.data || []);
      toast.success(`Generated 12 fiscal periods for FY${selectedYear}`);
    } catch (err: unknown) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (
    periodId: string,
    status: 'open' | 'soft_locked' | 'hard_closed',
  ) => {
    if (!canWrite) return;
    try {
      setActionLoading(periodId);
      await api.glControllerUpdateFiscalPeriodStatus(periodId, { status });
      toast.success(`Period status updated to ${status.replace('_', ' ')}`);
      await fetchPeriods();
    } catch (err: unknown) {
      toast.error(getErrorMessage(err));
    } finally {
      setActionLoading(null);
    }
  };

  const metrics = useMemo(() => {
    const total = periods.length;
    const openCount = periods.filter((p) => p.status === 'open').length;
    const softLockedCount = periods.filter((p) => p.status === 'soft_locked').length;
    const hardClosedCount = periods.filter((p) => p.status === 'hard_closed').length;
    return { total, openCount, softLockedCount, hardClosedCount };
  }, [periods]);

  return (
    <div className="flex-1 w-full h-full bg-white px-4 lg:px-8 py-6 overflow-y-auto">
      <EntityHeader
        title="Fiscal Periods"
        subtitle="Manage accounting period governance, monthly lock states, and year-end close."
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold text-[var(--text-muted)]">
                Fiscal Year:
              </label>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="input !w-auto !py-1.5 !text-sm font-semibold"
              >
                {[currentYear - 2, currentYear - 1, currentYear, currentYear + 1, currentYear + 2].map(
                  (yr) => (
                    <option key={yr} value={yr}>
                      FY{yr}
                    </option>
                  ),
                )}
              </select>
            </div>

            {canWrite && (
              <Button
                size="sm"
                variant="primary"
                onClick={handleGeneratePeriods}
                disabled={loading}
              >
                Generate 12 Monthly Periods
              </Button>
            )}
          </div>
        }
      />

      <div className="flex flex-col gap-6 mt-6">
        {/* ── Summary KPI Cards ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="card p-4 flex flex-col justify-between">
            <span className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">
              Total Periods
            </span>
            <span className="text-2xl font-bold text-[var(--text-primary)] mt-1">
              {metrics.total}
            </span>
          </div>
          <div className="card p-4 flex flex-col justify-between bg-emerald-50/40 border-emerald-200">
            <span className="text-xs font-medium text-emerald-700 uppercase tracking-wider">
              Open Periods
            </span>
            <span className="text-2xl font-bold text-emerald-800 mt-1">
              {metrics.openCount}
            </span>
          </div>
          <div className="card p-4 flex flex-col justify-between bg-amber-50/40 border-amber-200">
            <span className="text-xs font-medium text-amber-700 uppercase tracking-wider">
              Soft Locked
            </span>
            <span className="text-2xl font-bold text-amber-800 mt-1">
              {metrics.softLockedCount}
            </span>
          </div>
          <div className="card p-4 flex flex-col justify-between bg-rose-50/40 border-rose-200">
            <span className="text-xs font-medium text-rose-700 uppercase tracking-wider">
              Hard Closed
            </span>
            <span className="text-2xl font-bold text-rose-800 mt-1">
              {metrics.hardClosedCount}
            </span>
          </div>
        </div>

        {/* ── Fiscal Periods Table ── */}
        <div className="card overflow-hidden">
          <div className="p-4 border-b border-[var(--border)] flex items-center justify-between">
            <h3 className="text-base font-bold text-[var(--text-primary)]">
              Fiscal Periods for FY{selectedYear}
            </h3>
            {!canWrite && (
              <span className="text-xs font-medium text-[var(--text-muted)] bg-[var(--bg-secondary)] px-2.5 py-1 rounded-md">
                Read-Only Access
              </span>
            )}
          </div>

          {loading ? (
            <div className="text-sm text-muted animate-pulse py-12 text-center">
              Loading fiscal periods for FY{selectedYear}...
            </div>
          ) : periods.length === 0 ? (
            <div className="text-center py-12 px-4 border border-dashed rounded-lg m-4 border-[var(--border)]">
              <span className="material-symbols-outlined text-4xl text-[var(--text-muted)] mb-2">
                calendar_month
              </span>
              <p className="text-sm font-medium text-[var(--text-primary)] mb-1">
                No fiscal periods found for FY{selectedYear}
              </p>
              <p className="text-xs text-[var(--text-muted)] mb-4">
                Generate the 12 calendar monthly periods to enable double-entry accounting governance for this fiscal year.
              </p>
              {canWrite && (
                <Button size="sm" variant="primary" onClick={handleGeneratePeriods}>
                  Generate 12 Monthly Periods
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="border-b border-[var(--border)] text-xs uppercase text-[var(--text-muted)] bg-[var(--bg-secondary)]/50">
                    <th className="py-3 px-4 font-semibold">Period</th>
                    <th className="py-3 px-4 font-semibold">Start Date</th>
                    <th className="py-3 px-4 font-semibold">End Date</th>
                    <th className="py-3 px-4 font-semibold">Status</th>
                    <th className="py-3 px-4 font-semibold">Audit Details</th>
                    <th className="py-3 px-4 text-right font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {periods.map((p) => (
                    <tr key={p.periodId} className="hover:bg-[var(--bg-hover)] transition-colors">
                      <td className="py-3 px-4 font-semibold text-[var(--text-primary)]">
                        {p.periodName} (Period {p.periodNumber})
                      </td>
                      <td className="py-3 px-4 text-[var(--text-secondary)]">
                        {p.startDate}
                      </td>
                      <td className="py-3 px-4 text-[var(--text-secondary)]">
                        {p.endDate}
                      </td>
                      <td className="py-3 px-4">{getStatusBadge(p.status)}</td>
                      <td className="py-3 px-4 text-xs text-[var(--text-muted)]">
                        {p.status === 'hard_closed' && p.closedBy && (
                          <span>Closed by {p.closedBy}</span>
                        )}
                        {p.status === 'soft_locked' && p.lockedBy && (
                          <span>Locked by {p.lockedBy}</span>
                        )}
                        {p.status === 'open' && <span>—</span>}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {canWrite ? (
                          <div className="inline-flex items-center gap-2">
                            {p.status === 'open' && (
                              <>
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  className="!py-1 !text-xs !bg-amber-50 !text-amber-700 !border-amber-200 hover:!bg-amber-100"
                                  onClick={() =>
                                    handleUpdateStatus(p.periodId, 'soft_locked')
                                  }
                                  disabled={actionLoading === p.periodId}
                                >
                                  Soft Lock
                                </Button>
                                <Button
                                  size="sm"
                                  variant="danger"
                                  className="!py-1 !text-xs"
                                  onClick={() =>
                                    handleUpdateStatus(p.periodId, 'hard_closed')
                                  }
                                  disabled={actionLoading === p.periodId}
                                >
                                  Hard Close
                                </Button>
                              </>
                            )}

                            {p.status === 'soft_locked' && (
                              <>
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  className="!py-1 !text-xs"
                                  onClick={() =>
                                    handleUpdateStatus(p.periodId, 'open')
                                  }
                                  disabled={actionLoading === p.periodId}
                                >
                                  Re-open
                                </Button>
                                <Button
                                  size="sm"
                                  variant="danger"
                                  className="!py-1 !text-xs"
                                  onClick={() =>
                                    handleUpdateStatus(p.periodId, 'hard_closed')
                                  }
                                  disabled={actionLoading === p.periodId}
                                >
                                  Hard Close
                                </Button>
                              </>
                            )}

                            {p.status === 'hard_closed' && (
                              <Button
                                size="sm"
                                variant="secondary"
                                className="!py-1 !text-xs"
                                onClick={() => handleUpdateStatus(p.periodId, 'open')}
                                disabled={actionLoading === p.periodId}
                              >
                                Re-open Period
                              </Button>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-[var(--text-muted)]">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

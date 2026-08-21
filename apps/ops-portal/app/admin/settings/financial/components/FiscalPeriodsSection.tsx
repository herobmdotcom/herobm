import { useState, useEffect, useCallback } from 'react';
import * as api from '@herobm/sdk';
import { Button } from '@/components/shared/Button';
import { toast } from 'react-hot-toast';
import { getErrorMessage } from '@herobm/shared';

export function FiscalPeriodsSection() {
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
    try {
      setLoading(true);
      const res = await api.glControllerGenerateFiscalPeriods({
        fiscalYear: selectedYear,
      });
      setPeriods(res.data || []);
      toast.success(`Generated 12 fiscal periods for ${selectedYear}`);
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
    try {
      setActionLoading(periodId);
      await api.glControllerUpdateFiscalPeriodStatus(periodId, { status });
      toast.success(`Period status updated to ${status}`);
      await fetchPeriods();
    } catch (err: unknown) {
      toast.error(getErrorMessage(err));
    } finally {
      setActionLoading(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'open':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-800">
            Open
          </span>
        );
      case 'soft_locked':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800">
            {/* eslint-disable-next-line no-restricted-syntax -- UI Icon */}
            <span className="material-symbols-outlined text-xs mr-1">{'lock_clock'}</span>
            Soft Locked
          </span>
        );
      case 'hard_closed':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-rose-100 text-rose-800">
            {/* eslint-disable-next-line no-restricted-syntax -- UI Icon */}
            <span className="material-symbols-outlined text-xs mr-1">{'lock'}</span>
            Hard Closed
          </span>
        );
      default:
        return <span>{status}</span>;
    }
  };

  return (
    <div id="periods-section" className="card">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
        <h3 className="section-heading !mb-0">
          {/* eslint-disable-next-line no-restricted-syntax -- UI Icon */}
          <span className="material-symbols-outlined">{'calendar_month'}</span>
          <span>Fiscal Periods & Period Locking</span>
        </h3>

        <div className="flex items-center gap-3">
          <label className="text-xs font-medium text-[var(--text-muted)]">
            Fiscal Year:
          </label>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="input !w-auto !py-1 !text-sm"
          >
            {[currentYear - 2, currentYear - 1, currentYear, currentYear + 1].map(
              (yr) => (
                <option key={yr} value={yr}>
                  FY{yr}
                </option>
              ),
            )}
          </select>

          <Button
            size="sm"
            variant="secondary"
            onClick={handleGeneratePeriods}
            disabled={loading}
          >
            Generate FY Periods
          </Button>
        </div>
      </div>

      <p className="text-sm text-[var(--text-muted)] mb-4">
        Control accounting period states to prevent retroactive general ledger drift.
        Hard-closed periods reject all double-entry journal postings.
      </p>

      {loading ? (
        <div className="text-sm text-muted animate-pulse py-8 text-center">
          Loading fiscal periods...
        </div>
      ) : periods.length === 0 ? (
        <div className="text-center py-8 border border-dashed rounded-lg border-[var(--border)]">
          <p className="text-sm text-[var(--text-muted)] mb-3">
            No fiscal periods found for FY{selectedYear}.
          </p>
          <Button size="sm" onClick={handleGeneratePeriods}>
            Generate 12 Monthly Periods
          </Button>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] text-xs uppercase text-[var(--text-muted)]">
                <th className="py-2.5 px-3">Period</th>
                <th className="py-2.5 px-3">Start Date</th>
                <th className="py-2.5 px-3">End Date</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3">Audit Details</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {periods.map((p) => (
                <tr key={p.periodId} className="hover:bg-[var(--bg-hover)]">
                  <td className="py-2.5 px-3 font-semibold text-[var(--text-primary)]">
                    {p.periodName} (P{p.periodNumber})
                  </td>
                  <td className="py-2.5 px-3 text-[var(--text-secondary)]">
                    {p.startDate}
                  </td>
                  <td className="py-2.5 px-3 text-[var(--text-secondary)]">
                    {p.endDate}
                  </td>
                  <td className="py-2.5 px-3">{getStatusBadge(p.status)}</td>
                  <td className="py-2.5 px-3 text-xs text-[var(--text-muted)]">
                    {p.status === 'hard_closed' && p.closedBy && (
                      <span>Closed by {p.closedBy}</span>
                    )}
                    {p.status === 'soft_locked' && p.lockedBy && (
                      <span>Locked by {p.lockedBy}</span>
                    )}
                    {p.status === 'open' && <span>—</span>}
                  </td>
                  <td className="py-2.5 px-3 text-right">
                    <div className="inline-flex items-center gap-1.5">
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
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

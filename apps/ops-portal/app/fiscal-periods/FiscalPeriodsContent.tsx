'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import * as api from '@herobm/sdk';
import { Button } from '@/components/shared/Button';
import EntityHeader from '@/components/shared/EntityHeader';
import DetailsLayout from '@/components/shared/DetailsLayout';
import ActivityTimeline, { TimelineEvent } from '@/components/shared/ActivityTimeline';
import { toast } from 'react-hot-toast';
import { getErrorMessage, SystemResource, hasPermission } from '@herobm/shared';
import { useAuth } from '@/components/AuthGate';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';

const LOCK_CLOCK_ICON = 'lock_clock';
const LOCK_ICON = 'lock';

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
          <span className="material-symbols-outlined text-xs mr-1">{LOCK_CLOCK_ICON}</span>
          Soft Locked
        </span>
      );
    case 'hard_closed':
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-rose-100 text-rose-800">
          <span className="material-symbols-outlined text-xs mr-1">{LOCK_ICON}</span>
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

  const allEvents = useMemo(() => {
    const evts: TimelineEvent[] = [];
    for (const p of periods) {
      const periodWithEvents = p as unknown as { events?: TimelineEvent[] };
      if (Array.isArray(periodWithEvents.events)) {
        evts.push(...periodWithEvents.events);
      }
    }
    evts.sort(
      (a, b) =>
        new Date(b.createdOn).getTime() - new Date(a.createdOn).getTime(),
    );
    return evts;
  }, [periods]);

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

  return (
    <DetailsLayout
      header={
        <EntityHeader
          title="Fiscal Periods"
          subtitle="Manage accounting period governance, monthly lock states, and year-end close."
          actions={
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
          }
        />
      }
      showPrint={false}
    >
      <div className="flex flex-col gap-6">
        {/* ── Fiscal Periods Card & Table ── */}
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
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b border-[var(--border)] text-xs uppercase text-[var(--text-muted)] bg-[var(--bg-secondary)]/50">
                    <th className="py-3 px-4 font-semibold text-left">Period</th>
                    <th className="py-3 px-4 font-semibold text-left">Start Date</th>
                    <th className="py-3 px-4 font-semibold text-left">End Date</th>
                    <th className="py-3 px-4 font-semibold text-left">Status</th>
                    <th className="py-3 px-4 font-semibold text-left">Audit Details</th>
                    <th className="py-3 px-4 font-semibold text-right">Actions</th>
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

        {/* ── Activity Timeline Card ── */}
        <div id="activity-section" className="card p-4">
          <ActivityTimeline
            events={allEvents}
            defaultOpen={true}
            title="Fiscal Periods Activity Timeline"
            emptyMessage="No activity recorded for this fiscal year."
          />
        </div>
      </div>
    </DetailsLayout>
  );
}

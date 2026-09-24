'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import * as api from '@herobm/sdk';
import { Button } from '@/components/shared/Button';
import { DataTable, DataTableColumn } from '@/components/shared/DataTable';
import MobileLineItemCard from '@/components/shared/MobileLineItemCard';
import LocationSelect from '@/components/shared/LocationSelect';
import StateBadge from '@/components/StateBadge';
import type { ValidState } from '@/types/states';
import { reportError } from '@/lib/api';
import { formatAmount } from '@/lib/currency';
import { formatLocalDate } from '@/lib/date';
import { toast } from 'react-hot-toast';
import { getErrorMessage, calculateProjectMaterialsSummary, BIN_TYPE } from '@herobm/shared';
import type { InventoryBin } from '../useProject';
import { IssueProjectMaterialSlideOver } from './IssueProjectMaterialSlideOver';
import { ConsumeProjectMaterialSlideOver } from './ConsumeProjectMaterialSlideOver';
import { ReturnProjectMaterialSlideOver } from './ReturnProjectMaterialSlideOver';

interface ProjectMaterialsTabProps {
  projectId?: string;
  projectNumber?: string;
  projectName?: string;
  dto?: Partial<api.UpdateProjectDto>;
  stagingLocationId?: string | null;
  stagingBinId?: string | null;
  stagingInventory?: api.ProjectStagingInventoryItemDto[];
  budgetLines?: api.ProjectBudgetLineResponseDto[];
  ledgerEntries: api.ProjectLedgerEntryResponseDto[];
  tasks: api.ProjectTaskResponseDto[];
  currency: string;
  isEditable: boolean;
  discountPercentage?: number;
  loadBins: (locationId: string) => Promise<InventoryBin[]>;
  issueInventory: (dto: api.IssueInventoryDto) => Promise<void>;
  returnInventory: (dto: api.ReturnInventoryDto) => Promise<void>;
  reloadProject?: () => Promise<void>;
  updateField?: (field: keyof api.UpdateProjectDto, value: unknown) => void;
  saveField?: (field: keyof api.UpdateProjectDto, value: unknown) => Promise<void>;
}

export function ProjectMaterialsTab({
  projectId = '',
  projectNumber,
  projectName,
  dto,
  stagingLocationId,
  stagingBinId,
  stagingInventory = [],
  budgetLines = [],
  ledgerEntries = [],
  tasks = [],
  currency = 'USD',
  isEditable = false,
  discountPercentage,
  loadBins,
  issueInventory,
  returnInventory: _returnInventory,
  reloadProject,
  updateField,
  saveField,
}: ProjectMaterialsTabProps) {
  const t = useTranslations('projects');

  const [availableBins, setAvailableBins] = useState<InventoryBin[]>([]);
  const [loadingBins, setLoadingBins] = useState(false);

  const [transfers, setTransfers] = useState<api.TransferResponseDto[]>([]);
  const [transfersNextCursor, setTransfersNextCursor] = useState<string | null>(null);
  const [transfersHasMore, setTransfersHasMore] = useState<boolean>(false);
  const [loadingTransfers, setLoadingTransfers] = useState(false);
  const [totalTransfers, setTotalTransfers] = useState<number>(0);

  const initialMaterialEntries = useMemo(() => {
    return (ledgerEntries || []).filter((l) => {
      const isMaterial =
        l.lineType === 'item' ||
        l.sourceType === 'inventory_issue' ||
        l.sourceType === 'inventory' ||
        Boolean(l.productId);
      if (!isMaterial) return false;
      const desc = l.description || '';
      const isStagedEntry = desc.startsWith('Staged ') || desc.includes('Transfer Staging');
      const isReallocation = desc.startsWith('Reallocated from staging');
      return !isStagedEntry && !isReallocation;
    });
  }, [ledgerEntries]);

  const [paginatedMaterialEntries, setPaginatedMaterialEntries] = useState<api.ProjectLedgerEntryResponseDto[]>(initialMaterialEntries);
  const [materialNextCursor, setMaterialNextCursor] = useState<string | null>(null);
  const [materialHasMore, setMaterialHasMore] = useState<boolean>(false);
  const [loadingMaterialEntries, setLoadingMaterialEntries] = useState<boolean>(false);
  const [totalMaterialEntries, setTotalMaterialEntries] = useState<number>(initialMaterialEntries.length);

  const currentStagingLocId = dto?.stagingLocationId ?? stagingLocationId;
  const currentStagingBinId = dto?.stagingBinId ?? stagingBinId;

  const fetchTransfers = useCallback(async (cursorToFetch?: string | null, append = false) => {
    if (!projectId) return;
    setLoadingTransfers(true);
    try {
      const res = await api.transfersControllerFindAll({
        projectId,
        limit: 50,
        cursor: cursorToFetch || undefined,
      });
      const data = res.data as { data?: api.TransferResponseDto[]; nextCursor?: string | null; hasMore?: boolean; total?: number };
      const items = (Array.isArray(data?.data) ? data.data : (Array.isArray(res.data) ? res.data : []));
      if (append) {
        setTransfers((prev) => [...prev, ...items]);
      } else {
        setTransfers(items);
      }
      setTransfersNextCursor(data?.nextCursor ?? null);
      setTransfersHasMore(Boolean(data?.hasMore));
      if (data?.total !== undefined) {
        setTotalTransfers(data.total);
      }
    } catch (err) {
      reportError(err, 'ProjectMaterialsTab:fetchTransfers');
      toast.error(getErrorMessage(err));
    } finally {
      setLoadingTransfers(false);
    }
  }, [projectId]);

  const fetchMaterialLedger = useCallback(async (cursorToFetch?: string | null, append = false) => {
    if (!projectId) return;
    setLoadingMaterialEntries(true);
    try {
      const res = await api.projectsControllerGetLedgerEntries(projectId, {
        lineType: 'item',
        cursor: cursorToFetch || undefined,
        limit: 50,
      });
      const data = res.data as { data?: api.ProjectLedgerEntryResponseDto[]; nextCursor?: string | null; hasMore?: boolean; total?: number };
      const rawItems = Array.isArray(data?.data) ? data.data : (Array.isArray(res.data) ? res.data : []);
      const items = rawItems.filter((l) => {
        const desc = l.description || '';
        const isStagedEntry = desc.startsWith('Staged ') || desc.includes('Transfer Staging');
        const isReallocation = desc.startsWith('Reallocated from staging');
        return !isStagedEntry && !isReallocation;
      });
      if (append) {
        setPaginatedMaterialEntries((prev) => [...prev, ...items]);
      } else {
        setPaginatedMaterialEntries(items);
      }
      setMaterialNextCursor(data?.nextCursor ?? null);
      setMaterialHasMore(Boolean(data?.hasMore));
      if (data?.total !== undefined) {
        setTotalMaterialEntries(data.total);
      }
    } catch (err) {
      reportError(err, 'ProjectMaterialsTab:fetchMaterialLedger'); // fallback
    } finally {
      setLoadingMaterialEntries(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchTransfers();
    fetchMaterialLedger();
  }, [fetchTransfers, fetchMaterialLedger]);

  useEffect(() => {
    if (initialMaterialEntries.length > 0 && paginatedMaterialEntries.length === 0) {
      setPaginatedMaterialEntries(initialMaterialEntries);
    }
  }, [initialMaterialEntries, paginatedMaterialEntries.length]);

  const effectiveMaterialUsageEntries = paginatedMaterialEntries.length > 0 ? paginatedMaterialEntries : initialMaterialEntries;

  useEffect(() => {
    if (!currentStagingLocId) {
      setAvailableBins([]);
      return;
    }
    setLoadingBins(true);
    loadBins(currentStagingLocId)
      .then((bins) => setAvailableBins(bins || []))
      .catch((err) => {
        reportError(err, 'ProjectMaterialsTab:loadBins'); // fallback
        setAvailableBins([]);
      })
      .finally(() => setLoadingBins(false));
  }, [currentStagingLocId, loadBins]);

  const [showIssueSlideOver, setShowIssueSlideOver] = useState(false);
  const [showConsumeSlideOver, setShowConsumeSlideOver] = useState(false);
  const [showReturnSlideOver, setShowReturnSlideOver] = useState(false);

  // Unified materials summary combining physical staging bin stock, in-flight transfers, and project ledger entries
  const materialsList = useMemo(() => {
    return calculateProjectMaterialsSummary(stagingInventory, transfers, ledgerEntries);
  }, [stagingInventory, transfers, ledgerEntries]);

  const materialColumns: DataTableColumn<ReturnType<typeof calculateProjectMaterialsSummary>[0]>[] = useMemo(
    () => [
      {
        id: 'product',
        header: t('columns.product'),
        render: (mat) => (
          <span className="font-mono text-xs font-semibold text-[var(--text-primary)]">
            {mat.productNumber}
          </span>
        ),
      },
      {
        id: 'description',
        header: t('columns.description'),
        render: (mat) => <span className="text-xs text-[var(--text-primary)]">{mat.productDescription}</span>,
      },
      {
        id: 'staged',
        header: t('columns.staged'),
        align: 'right',
        render: (mat) => (
          <span className="font-mono text-xs font-medium text-[var(--text-primary)]">
            {mat.stagedQty.toLocaleString()}
          </span>
        ),
      },
      {
        id: 'arriving',
        header: t('columns.arriving'),
        align: 'right',
        render: (mat) => (
          <span className="font-mono text-xs font-semibold text-amber-600 dark:text-amber-400">
            {mat.arrivingQty.toLocaleString()}
          </span>
        ),
      },
      {
        id: 'returning',
        header: t('columns.returning'),
        align: 'right',
        render: (mat) => (
          <span className="font-mono text-xs font-semibold text-rose-600 dark:text-rose-400">
            {mat.returningQty.toLocaleString()}
          </span>
        ),
      },
      {
        id: 'available',
        header: t('columns.available'),
        align: 'right',
        render: (mat) => (
          <span className="font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400">
            {mat.availableQty.toLocaleString()}
          </span>
        ),
      },
      {
        id: 'consumed',
        header: t('columns.consumed'),
        align: 'right',
        render: (mat) => (
          <span className="font-mono text-xs text-[var(--text-muted)]">
            {mat.consumedQty.toLocaleString()}
          </span>
        ),
      },
      {
        id: 'returned',
        header: t('columns.returned'),
        align: 'right',
        render: (mat) => (
          <span className="font-mono text-xs text-blue-600 dark:text-blue-400">
            {mat.returnedQty.toLocaleString()}
          </span>
        ),
      },
      {
        id: 'actualCost',
        header: t('columns.actualCost'),
        align: 'right',
        render: (mat) => (
          <span className="font-mono text-xs font-semibold text-[var(--accent)]">
            {formatAmount(Number(mat.totalCost || 0), currency)}
          </span>
        ),
      },
    ],
    [t, currency]
  );

  const transferColumns: DataTableColumn<api.TransferResponseDto>[] = useMemo(
    () => [
      {
        id: 'orderNumber',
        header: t('columns.orderNumber'),
        render: (order) => {
          const transferId =
            (order as { id?: string; transferOrderId?: string }).id ||
            order.transferOrderId ||
            '';
          return (
            <Link
              href={`/inventory/transfers/${transferId || order.orderNumber}`}
              className="text-[var(--accent)] hover:underline inline-flex items-center gap-1 font-mono text-xs font-semibold"
            >
              {order.orderNumber}
            </Link>
          );
        },
      },
      {
        id: 'status',
        header: t('columns.status'),
        render: (order) => <StateBadge state={order.stateCode as ValidState} />,
      },
      {
        id: 'sourceLocation',
        header: t('columns.sourceLocation'),
        render: (order) => (
          <span className="text-xs text-[var(--text-primary)]">
            {order.sourceLocationName || order.sourceLocationId || '—'}
          </span>
        ),
      },
      {
        id: 'destinationLocation',
        header: t('columns.destinationLocation'),
        render: (order) => (
          <span className="text-xs text-[var(--text-primary)]">
            {order.destinationLocationName || order.destinationLocationId || '—'}
          </span>
        ),
      },
      {
        id: 'items',
        header: t('columns.items'),
        align: 'right',
        render: (order) => (
          <span className="font-mono text-xs text-[var(--text-muted)]">
            {t('labels.itemsCount', { count: order.lines?.length || 0 })}
          </span>
        ),
      },
      {
        id: 'entryDate',
        header: t('columns.entryDate'),
        render: (order) => (
          <span className="font-mono text-xs text-[var(--text-muted)]">
            {formatLocalDate(order.createdOn)}
          </span>
        ),
      },
      {
        id: 'notes',
        header: t('columns.notes'),
        render: (order) => (
          <span className="text-xs text-[var(--text-muted)] max-w-xs truncate block">
            {order.notes || '—'}
          </span>
        ),
      },
    ],
    [t]
  );

  const materialUsageEntries = effectiveMaterialUsageEntries;

  const materialUsageColumns: DataTableColumn<api.ProjectLedgerEntryResponseDto>[] = useMemo(
    () => [
      {
        id: 'entryDate',
        header: t('columns.entryDate'),
        width: '120px',
        render: (entry) => (
          <span className="font-mono text-xs text-[var(--text-muted)]">
            {formatLocalDate(entry.postingDate || entry.createdOn)}
          </span>
        ),
      },
      {
        id: 'product',
        header: t('columns.product'),
        render: (entry) => {
          const matchedMat = materialsList.find((m) => m.productId === entry.productId);
          const prodNum =
            matchedMat?.productNumber && matchedMat.productNumber !== '—'
              ? matchedMat.productNumber
              : undefined;
          const prodDesc =
            matchedMat?.productDescription && matchedMat.productDescription !== '—'
              ? matchedMat.productDescription
              : entry.description || '—';

          return (
            <div>
              <span className="font-semibold text-xs text-[var(--text-primary)] block">
                {prodDesc}
              </span>
              {prodNum && (
                <span className="font-mono text-[11px] text-[var(--text-muted)] block">
                  {prodNum}
                </span>
              )}
            </div>
          );
        },
      },
      {
        id: 'task',
        header: t('labels.task'),
        render: (entry) => {
          const matchedTask = tasks.find((tk) => tk.projectTaskId === entry.projectTaskId);
          return (
            <span className="text-xs text-[var(--text-primary)]">
              {matchedTask
                ? `${matchedTask.taskCode ? `${matchedTask.taskCode} ` : ''}${matchedTask.name}`
                : '—'}
            </span>
          );
        },
      },
      {
        id: 'quantity',
        header: t('columns.quantity'),
        align: 'right',
        render: (entry) => (
          <span className="font-mono text-xs font-semibold text-[var(--text-primary)]">
            {Number(entry.quantity || 0).toLocaleString()}
          </span>
        ),
      },
      {
        id: 'unitCost',
        header: t('columns.unitCost'),
        align: 'right',
        render: (entry) => (
          <span className="font-mono text-xs text-[var(--text-muted)]">
            {formatAmount(Number(entry.unitCostBase || 0), currency)}
          </span>
        ),
      },
      {
        id: 'totalCost',
        header: t('columns.actualCost'),
        align: 'right',
        render: (entry) => (
          <span className="font-mono text-xs font-semibold text-rose-600 dark:text-rose-400">
            {formatAmount(Number(entry.totalCostBase || 0), currency)}
          </span>
        ),
      },
      {
        id: 'totalPrice',
        header: t('columns.actualRevenue'),
        align: 'right',
        render: (entry) => (
          <span className="font-mono text-xs font-semibold text-emerald-600 dark:text-emerald-400">
            {formatAmount(Number(entry.totalPriceBase || 0), currency)}
          </span>
        ),
      },
      {
        id: 'notes',
        header: t('columns.notes'),
        render: (entry) => (
          <span className="text-xs text-[var(--text-muted)] max-w-xs truncate block">
            {entry.description || '—'}
          </span>
        ),
      },
    ],
    [t, materialsList, tasks, currency]
  );

  return (
    <div className="flex flex-col gap-4">
      {/* Inventory Card */}
      <div id="inventory-section" className="card">
        <h3 className="section-heading">
          <span className="material-symbols-outlined">warehouse</span>
          {t('sections.inventory')}
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Staging Warehouse / Location */}
          <div>
            <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
              {t('labels.stagingLocation')}
            </label>
            <LocationSelect
              value={currentStagingLocId ?? null}
              onChange={async (locId) => {
                if (updateField && saveField) {
                  updateField('stagingLocationId', locId);
                  updateField('stagingBinId', null);
                  await saveField('stagingLocationId', locId);
                  await saveField('stagingBinId', null);
                }
              }}
              disabled={!isEditable}
              placeholder={t('placeholders.selectStagingLocation')}
            />
          </div>

          {/* Staging Bin */}
          <div>
            <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
              {t('labels.stagingBin')}
            </label>
            <select
              className="input w-full"
              value={currentStagingBinId ?? ''}
              onChange={(e) => {
                const val = e.target.value || null;
                if (updateField && saveField) {
                  updateField('stagingBinId', val);
                  saveField('stagingBinId', val);
                }
              }}
              disabled={!isEditable || !currentStagingLocId || loadingBins}
            >
              <option value="">
                {loadingBins
                  ? t('placeholders.loadingBins')
                  : !currentStagingLocId
                  ? t('placeholders.selectLocationFirst')
                  : t('placeholders.unassignedBin')}
              </option>
              {availableBins
                .filter((bin) => bin.binType === BIN_TYPE.PROJECT || bin.binId === currentStagingBinId)
                .map((bin) => (
                  <option key={bin.binId} value={bin.binId}>
                    {bin.binNumber} {bin.binType ? `(${bin.binType})` : ''}
                  </option>
                ))}
            </select>
          </div>
        </div>
      </div>

      {/* Materials Summary Card */}
      <div id="materials-section" className="card space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h3 className="section-heading !mb-0">
            <span className="material-symbols-outlined">inventory_2</span>
            {t('tabs.materials')}
          </h3>
          {isEditable && (
            <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
              <Button size="sm" variant="secondary" onClick={() => setShowReturnSlideOver(true)}>
                {t('buttons.returnMaterial')}
              </Button>
              <Button size="sm" variant="secondary" onClick={() => setShowIssueSlideOver(true)}>
                {t('buttons.stageStock')}
              </Button>
              <Button size="sm" variant="primary" onClick={() => setShowConsumeSlideOver(true)}>
                {t('buttons.consumeMaterial')}
              </Button>
            </div>
          )}
        </div>

        <DataTable<ReturnType<typeof calculateProjectMaterialsSummary>[0]>
          columns={materialColumns}
          data={materialsList}
          keyExtractor={(mat, idx) => `mat-${idx}-${mat.productId || mat.productNumber || mat.productDescription}`}
          emptyMessage={t('placeholders.noMaterials')}
          mobileCard={(mat) => (
            <MobileLineItemCard
              title={
                <span className="font-mono font-bold text-sm text-[var(--accent)]">
                  {mat.productNumber}
                </span>
              }
              subtitle={mat.productDescription || undefined}
              topRightBadge={
                <span className="badge badge-success font-semibold">
                  {mat.availableQty.toLocaleString()} {t('columns.available')}
                </span>
              }
              details={[
                { label: t('columns.staged'), value: mat.stagedQty.toLocaleString() },
                {
                  label: t('columns.arriving'),
                  value: (
                    <span className="text-amber-600 dark:text-amber-400 font-semibold">
                      {mat.arrivingQty.toLocaleString()}
                    </span>
                  ),
                },
                {
                  label: t('columns.returning'),
                  value: (
                    <span className="text-amber-600 dark:text-amber-400 font-semibold">
                      {mat.returningQty.toLocaleString()}
                    </span>
                  ),
                },
                {
                  label: t('columns.available'),
                  value: (
                    <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                      {mat.availableQty.toLocaleString()}
                    </span>
                  ),
                  isHighlighted: true,
                },
                { label: t('columns.consumed'), value: mat.consumedQty.toLocaleString() },
                {
                  label: t('columns.returned'),
                  value: (
                    <span className="text-blue-600 dark:text-blue-400 font-medium">
                      {mat.returnedQty.toLocaleString()}
                    </span>
                  ),
                },
                {
                  label: t('columns.actualCost'),
                  value: formatAmount(Number(mat.totalCost || 0), currency),
                  isHighlighted: true,
                },
              ]}
            />
          )}
        />

        {/* SlideOver: Stage Material (Transfer Order) */}
        <IssueProjectMaterialSlideOver
          isOpen={showIssueSlideOver}
          onClose={() => setShowIssueSlideOver(false)}
          projectId={projectId}
          projectNumber={projectNumber}
          projectName={projectName}
          stagingLocationId={currentStagingLocId}
          tasks={tasks}
          currency={currency}
          onSuccess={async () => {
            await fetchTransfers();
            await fetchMaterialLedger();
            if (reloadProject) {
              await reloadProject();
            }
          }}
        />

        {/* SlideOver: Consume Material on Task */}
        <ConsumeProjectMaterialSlideOver
          isOpen={showConsumeSlideOver}
          onClose={() => setShowConsumeSlideOver(false)}
          projectId={projectId}
          projectNumber={projectNumber}
          stagingLocationId={currentStagingLocId}
          stagingBinId={currentStagingBinId}
          tasks={tasks}
          budgetLines={budgetLines}
          ledgerEntries={ledgerEntries}
          currency={currency}
          availableMaterials={materialsList}
          discountPercentage={discountPercentage}
          issueInventory={issueInventory}
          onSuccess={async () => {
            await fetchMaterialLedger();
            await fetchTransfers();
            if (reloadProject) {
              await reloadProject();
            }
          }}
        />

        {/* SlideOver: Return Stock (Transfer Order) */}
        <ReturnProjectMaterialSlideOver
          isOpen={showReturnSlideOver}
          onClose={() => setShowReturnSlideOver(false)}
          projectId={projectId}
          projectNumber={projectNumber}
          stagingLocationId={currentStagingLocId}
          availableMaterials={materialsList}
          onSuccess={async () => {
            await fetchTransfers();
            await fetchMaterialLedger();
            if (reloadProject) {
              await reloadProject();
            }
          }}
        />
      </div>

      {/* Transfer Orders Card */}
      <div id="transfers-section" className="card space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="section-heading !mb-0">
            <span className="material-symbols-outlined">local_shipping</span>
            {t('sections.transferOrders')}
          </h3>
        </div>

        {loadingTransfers ? (
          <div className="p-8 text-center text-sm text-[var(--text-muted)] border border-[var(--border)] rounded-lg">
            {t('placeholders.loadingTransferOrders')}
          </div>
        ) : (
          <DataTable<api.TransferResponseDto>
            columns={transferColumns}
            data={transfers}
            keyExtractor={(order, idx) => {
              const transferId =
                (order as { id?: string; transferOrderId?: string }).id ||
                order.transferOrderId ||
                '';
              return transferId || order.orderNumber || `to-${idx}`;
            }}
            emptyMessage={t('placeholders.noTransferOrders')}
            mobileCard={(order) => {
              const lineCount = order.lines?.length || 0;
              const transferId =
                (order as { id?: string; transferOrderId?: string }).id ||
                order.transferOrderId ||
                '';

              return (
                <MobileLineItemCard
                  title={
                    <Link
                      href={`/inventory/transfers/${transferId || order.orderNumber}`}
                      className="text-[var(--accent)] hover:underline inline-flex items-center gap-1 font-mono font-bold text-sm"
                    >
                      {order.orderNumber}
                    </Link>
                  }
                  subtitle={order.notes || undefined}
                  topRightBadge={<StateBadge state={order.stateCode as ValidState} />}
                  details={[
                    {
                      label: t('columns.sourceLocation'),
                      value: order.sourceLocationName || order.sourceLocationId || '—',
                    },
                    {
                      label: t('columns.destinationLocation'),
                      value: order.destinationLocationName || order.destinationLocationId || '—',
                    },
                    {
                      label: t('columns.items'),
                      value: t('labels.itemsCount', { count: lineCount }),
                    },
                    {
                      label: t('columns.entryDate'),
                      value: formatLocalDate(order.createdOn),
                    },
                  ]}
                />
              );
            }}
          />
        )}

        {transfersHasMore && (
          <div className="flex items-center justify-center pt-4 border-t border-[var(--border)]">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={loadingTransfers}
              onClick={() => fetchTransfers(transfersNextCursor, true)}
            >
              {loadingTransfers
                ? t('buttons.loadingMore') || 'Loading...'
                : t('buttons.loadMoreTransfers') || `Load More Transfers (${totalTransfers > transfers.length ? `${transfers.length} of ${totalTransfers}` : 'More'})`}
            </Button>
          </div>
        )}
      </div>

      {/* Material Usage Card */}
      <div id="material-usage-section" className="card space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="section-heading !mb-0">
            <span className="material-symbols-outlined">receipt_long</span>
            {t('sections.materialUsage')}
          </h3>
        </div>

        <DataTable<api.ProjectLedgerEntryResponseDto>
          columns={materialUsageColumns}
          data={materialUsageEntries}
          keyExtractor={(entry, idx) => entry.ledgerId || `mat-usage-${idx}`}
          emptyMessage={t('placeholders.noMaterialUsage')}
          mobileCard={(entry) => {
            const matchedMat = materialsList.find((m) => m.productId === entry.productId);
            const matchedTask = tasks.find((tk) => tk.projectTaskId === entry.projectTaskId);
            const prodNum =
              matchedMat?.productNumber && matchedMat.productNumber !== '—'
                ? matchedMat.productNumber
                : undefined;
            const prodDesc =
              matchedMat?.productDescription && matchedMat.productDescription !== '—'
                ? matchedMat.productDescription
                : entry.description || 'Material Usage';

            return (
              <MobileLineItemCard
                title={prodDesc}
                subtitle={
                  [
                    prodNum ? `SKU: ${prodNum}` : undefined,
                    matchedTask
                      ? `Task: ${matchedTask.taskCode ? `${matchedTask.taskCode} ` : ''}${matchedTask.name}`
                      : undefined,
                  ]
                    .filter(Boolean)
                    .join(' • ') || undefined
                }
                topRightBadge={
                  <span className="font-mono text-xs font-bold text-[var(--accent)]">
                    {Number(entry.quantity || 0).toLocaleString()}
                  </span>
                }
                details={[
                  {
                    label: t('columns.entryDate'),
                    value: formatLocalDate(entry.postingDate || entry.createdOn),
                  },
                  {
                    label: t('columns.actualCost'),
                    value: formatAmount(Number(entry.totalCostBase || 0), currency),
                    isHighlighted: true,
                  },
                  {
                    label: t('columns.actualRevenue'),
                    value: formatAmount(Number(entry.totalPriceBase || 0), currency),
                  },
                  {
                    label: t('columns.notes'),
                    value: entry.description || '—',
                  },
                ]}
              />
            );
          }}
        />

        {materialHasMore && (
          <div className="flex items-center justify-center pt-4 border-t border-[var(--border)]">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={loadingMaterialEntries}
              onClick={() => fetchMaterialLedger(materialNextCursor, true)}
            >
              {loadingMaterialEntries
                ? t('buttons.loadingMore') || 'Loading...'
                : t('buttons.loadMoreMaterialEntries') || `Load More Entries (${totalMaterialEntries > paginatedMaterialEntries.length ? `${paginatedMaterialEntries.length} of ${totalMaterialEntries}` : 'More'})`}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

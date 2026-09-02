'use client';

import React, { useState, useEffect, useCallback } from 'react';
import * as api from '@herobm/sdk';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { formatLocalDate } from '@/lib/date';
import { reportError } from '@/lib/api';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import EntityHeader from '@/components/shared/EntityHeader';
import DetailsLayout from '@/components/shared/DetailsLayout';
import StateBadge from '@/components/StateBadge';
import { DataTable, DataTableColumn } from '@/components/shared/DataTable';
import MobileLineItemCard from '@/components/shared/MobileLineItemCard';
import ActivityTimeline, { TimelineEvent } from '@/components/shared/ActivityTimeline';
import SupplierSelect, { Supplier } from '@/components/shared/SupplierSelect';
import LocationSelect from '@/components/shared/LocationSelect';
import { routes } from '@/lib/routes';
import { Button } from '@/components/shared/Button';
import { GOODS_RECEIVED_STATE, PUTAWAY_STATUS, MATCH_STATUS, getErrorMessage } from '@herobm/shared';
import toast from 'react-hot-toast';
import AllocationSlideOver, { GoodsReceivedLine } from '../AllocationSlideOver';
import QuarantineModal from '../QuarantineModal';
import type { ValidState } from '@/types/states';

interface ReceptionLine {
  goodsReceivedLineId: string;
  productId: string;
  quantityReceived: string;
  matchStatus: string;
  putawayStatus?: string;
  purchaseOrderLineId?: string | null;
  purchaseOrderId?: string | null;
  productNumber?: string | null;
  productName?: string | null;
  orderNumber?: string | null;
}

interface ReceptionDetailData {
  goodsReceivedId: string;
  receiptNumber: string;
  vendorId: string;
  locationId: string;
  packingSlipNumber?: string | null;
  notes?: string | null;
  stateCode: string;
  createdBy?: string | null;
  createdOn: string;
  vendorName?: string | null;
  vendorNumber?: string | null;
  locationName?: string | null;
  lines?: ReceptionLine[];
  events?: TimelineEvent[];
}

export default function ReceptionDetailContent({ id }: { id: string }) {
  const t = useTranslations('goodsReceived');
  const tCommon = useTranslations('common');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState<ReceptionDetailData | null>(null);
  const [cancelling, setCancelling] = useState(false);

  // Editable form fields
  const [editVendorId, setEditVendorId] = useState<string | null>(null);
  const [editLocationId, setEditLocationId] = useState<string | null>(null);
  const [editPackingSlip, setEditPackingSlip] = useState<string>('');
  const [editNotes, setEditNotes] = useState<string>('');

  // Modals for line actions
  const [selectedAllocationLine, setSelectedAllocationLine] = useState<GoodsReceivedLine | null>(null);
  const [quarantineLine, setQuarantineLine] = useState<ReceptionLine | null>(null);

  const syncFormState = useCallback((resData: ReceptionDetailData) => {
    setData(resData);
    setEditVendorId(resData.vendorId || null);
    setEditLocationId(resData.locationId || null);
    setEditPackingSlip(resData.packingSlipNumber || '');
    setEditNotes(resData.notes || '');
  }, []);

  const fetchReception = useCallback(() => {
    setLoading(true);
    api.goodsReceivedControllerFindOne(id)
      .then((res) => {
        syncFormState(res.data as unknown as ReceptionDetailData);
      })
      .catch((err) => reportError(err, 'ReceptionDetailContent'))
      .finally(() => setLoading(false));
  }, [id, syncFormState]);

  useEffect(() => {
    fetchReception();
  }, [fetchReception]);

  useDocumentTitle(data ? `Receipt ${data.receiptNumber}` : 'Goods Receipt Details');

  const handleSaveFields = async (updates: {
    vendorId?: string | null;
    locationId?: string | null;
    packingSlipNumber?: string;
    notes?: string;
  }) => {
    if (!data) return;
    setSaving(true);
    try {
      const payload: Parameters<typeof api.goodsReceivedControllerUpdate>[1] = {};
      if (updates.vendorId !== undefined && updates.vendorId !== data.vendorId) {
        if (updates.vendorId) payload.vendorId = updates.vendorId;
      }
      if (updates.locationId !== undefined && updates.locationId !== data.locationId) {
        if (updates.locationId) payload.locationId = updates.locationId;
      }
      if (updates.packingSlipNumber !== undefined && updates.packingSlipNumber !== (data.packingSlipNumber || '')) {
        payload.packingSlipNumber = updates.packingSlipNumber;
      }
      if (updates.notes !== undefined && updates.notes !== (data.notes || '')) {
        payload.notes = updates.notes;
      }

      if (Object.keys(payload).length === 0) {
        setSaving(false);
        return;
      }

      const res = await api.goodsReceivedControllerUpdate(id, payload);
      syncFormState(res.data as unknown as ReceptionDetailData);
      toast.success(t('messages.saved'));
    } catch (err) {
      reportError(err, 'ReceptionDetailContent.save');
      toast.error(getErrorMessage(err) || t('messages.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const handleCancelReception = async () => {
    if (!data) return;
    if (!window.confirm(`Are you sure you want to cancel receipt ${data.receiptNumber}? This cannot be undone.`)) {
      return;
    }

    setCancelling(true);
    try {
      await api.goodsReceivedControllerCancelReception(data.goodsReceivedId, {});
      toast.success('Receipt cancelled successfully');
      fetchReception();
    } catch (err) {
      reportError(err, 'ReceptionDetailContent.cancel');
      toast.error(getErrorMessage(err) || 'Failed to cancel receipt');
    } finally {
      setCancelling(false);
    }
  };

  const handleQuarantineSubmit = async (reason: string, targetBinId?: string) => {
    if (!quarantineLine) return;
    try {
      await api.inventoryControllerQuarantineMove({
        lineId: quarantineLine.goodsReceivedLineId,
        sourceType: 'goods_receipt',
        quantity: quarantineLine.quantityReceived || '0',
        reason,
        targetBinId,
      });
      toast.success('Line quarantined successfully');
      setQuarantineLine(null);
      fetchReception();
    } catch (err) {
      reportError(err, 'ReceptionDetailContent.quarantine');
      toast.error(getErrorMessage(err) || 'Failed to quarantine line');
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-[var(--text-muted)]">{tCommon('loading')}</div>;
  }

  if (!data) {
    return <div className="p-8 text-center text-red-500">{tCommon('noData')}</div>;
  }

  const lines = data.lines || [];
  const isCancelled = data.stateCode === GOODS_RECEIVED_STATE.CANCELLED;

  const lineColumns: DataTableColumn<ReceptionLine>[] = [
    {
      id: 'index',
      header: '#',
      width: 40,
      render: (_, i) => <span className="text-[var(--text-muted)]">{i + 1}</span>,
    },
    {
      id: 'product',
      header: t('columns.product'),
      width: 150,
      render: (line) => (
        <Link
          href={routes.products.detail(line.productId)}
          className="font-semibold text-[var(--accent)] hover:underline"
        >
          {line.productNumber || '—'}
        </Link>
      ),
    },
    {
      id: 'name',
      header: t('columns.return.description'),
      render: (line) => line.productName || '—',
    },
    {
      id: 'qty',
      header: t('columns.receivedQty'),
      width: 110,
      align: 'right',
      render: (line) => (
        <span className="tabular-nums font-medium">
          {parseFloat(line.quantityReceived || '0').toLocaleString()}
        </span>
      ),
    },
    {
      id: 'po',
      header: t('columns.return.order'),
      width: 140,
      render: (line) => {
        if (!line.purchaseOrderId) {
          return <span className="text-[var(--text-muted)]">—</span>;
        }
        return (
          <Link
            href={routes.purchaseOrders.detail(line.purchaseOrderId)}
            className="font-medium text-[var(--accent)] hover:underline"
          >
            {line.orderNumber ? line.orderNumber : t('columns.return.order')}
          </Link>
        );
      },
    },
    {
      id: 'matchStatus',
      header: t('columns.matchStatus'),
      width: 120,
      render: (line) => {
        if (line.matchStatus === MATCH_STATUS.MATCHED) {
          return (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
              Matched
            </span>
          );
        }
        if (line.matchStatus === MATCH_STATUS.AMBIGUOUS) {
          return (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
              Multiple POs
            </span>
          );
        }
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200">
            Unmatched
          </span>
        );
      },
    },
    {
      id: 'putawayStatus',
      header: 'Putaway Status',
      width: 130,
      render: (line) => {
        if (isCancelled) {
          return <span className="text-xs text-slate-400">Cancelled</span>;
        }
        if (line.putawayStatus === PUTAWAY_STATUS.COMPLETED) {
          return (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-50 text-emerald-700">
              Completed
            </span>
          );
        }
        if (line.putawayStatus === PUTAWAY_STATUS.QUARANTINED) {
          return (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-rose-50 text-rose-700">
              Quarantined
            </span>
          );
        }
        if (line.putawayStatus === PUTAWAY_STATUS.PENDING_PUTAWAY) {
          return (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700">
              Pending
            </span>
          );
        }
        if (line.putawayStatus === PUTAWAY_STATUS.AWAITING_MATCHING) {
          return (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-50 text-amber-700">
              Awaiting Match
            </span>
          );
        }
        return <span className="text-xs text-slate-500">{line.putawayStatus || '—'}</span>;
      },
    },
    {
      id: 'actions',
      header: '',
      width: 120,
      align: 'right',
      render: (line) => {
        if (isCancelled) return null;
        const canAllocate = line.matchStatus !== MATCH_STATUS.MATCHED || line.putawayStatus === PUTAWAY_STATUS.AWAITING_MATCHING;
        const canQuarantine = line.putawayStatus !== PUTAWAY_STATUS.QUARANTINED && line.putawayStatus !== PUTAWAY_STATUS.COMPLETED;

        return (
          <div className="flex items-center justify-end gap-1">
            {canAllocate && (
              <Button
                variant="secondary"
                size="sm"
                className="text-xs py-1 px-2"
                onClick={() => setSelectedAllocationLine({
                  goodsReceivedLineId: line.goodsReceivedLineId,
                  matchStatus: line.matchStatus,
                  putawayStatus: line.putawayStatus,
                  productId: line.productId,
                  vendorId: data.vendorId,
                  quantityReceived: line.quantityReceived,
                  locationId: data.locationId,
                  productNumber: line.productNumber,
                  productName: line.productName,
                  vendorName: data.vendorName,
                  receiptNumber: data.receiptNumber,
                  locationName: data.locationName,
                })}
              >
                {t('buttons.match')}
              </Button>
            )}
            {canQuarantine && (
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-rose-600 hover:bg-rose-50 py-1 px-2"
                onClick={() => setQuarantineLine(line)}
                title={t('buttons.quarantine')}
              >
                <span className="material-symbols-outlined text-[16px]">warning</span>
              </Button>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <DetailsLayout
      header={
        <EntityHeader
          title={`Receipt ${data.receiptNumber}`}
          subtitle={data.vendorName ? `Received from ${data.vendorName} · ${formatLocalDate(data.createdOn)}` : `${formatLocalDate(data.createdOn)} · Goods Receipt`}
          badges={<StateBadge state={data.stateCode as ValidState} />}
          isSaving={saving}
          actions={
            !isCancelled ? (
              <Button
                variant="danger"
                size="sm"
                onClick={handleCancelReception}
                disabled={cancelling || saving}
              >
                {cancelling ? tCommon('loading') : t('buttons.cancel')}
              </Button>
            ) : undefined
          }
        />
      }
    >
      <div className="space-y-6">
        {/* Overview & Source Documents Card */}
        <div className="card">
          <h3 className="section-heading mb-4 flex items-center gap-2">
            <span className="material-symbols-outlined shrink-0">info</span>
            <span>Receipt Overview</span>
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
            <div>
              <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">
                {t('labels.supplier')}
              </label>
              {isCancelled ? (
                data.vendorId ? (
                  <Link
                    href={routes.suppliers.detail(data.vendorId)}
                    className="text-[var(--accent)] hover:underline font-medium pt-1.5 block"
                  >
                    {data.vendorName ? data.vendorName : (data.vendorNumber ? data.vendorNumber : t('columns.supplier'))}
                  </Link>
                ) : (
                  <span className="font-medium text-[var(--text-primary)] pt-1.5 block">{data.vendorName || '—'}</span>
                )
              ) : (
                <div className="flex items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <SupplierSelect
                      value={editVendorId}
                      initialSearchTerm={data.vendorName || data.vendorNumber || ''}
                      placeholder={t('placeholders.selectSupplier')}
                      disabled={saving}
                      onChange={(supplier: Supplier | null) => {
                        const newVendorId = supplier?.vendorId || null;
                        setEditVendorId(newVendorId);
                        handleSaveFields({ vendorId: newVendorId });
                      }}
                    />
                  </div>
                  {data.vendorId && (
                    <Link
                      href={routes.suppliers.detail(data.vendorId)}
                      className="text-[var(--accent)] hover:text-[var(--accent-hover)] p-1 shrink-0"
                      title={t('columns.supplier')}
                    >
                      <span className="material-symbols-outlined text-[18px]">open_in_new</span>
                    </Link>
                  )}
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">
                {t('labels.packingSlip')}
              </label>
              <input
                className="input font-mono text-sm w-full"
                value={editPackingSlip}
                onChange={(e) => setEditPackingSlip(e.target.value)}
                onBlur={() => handleSaveFields({ packingSlipNumber: editPackingSlip })}
                disabled={isCancelled || saving}
                placeholder={t('placeholders.packingSlip')}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">
                {t('labels.location')}
              </label>
              <LocationSelect
                value={editLocationId}
                onChange={(newLocId) => {
                  setEditLocationId(newLocId);
                  handleSaveFields({ locationId: newLocId });
                }}
                disabled={isCancelled || saving}
                placeholder={t('placeholders.selectLocation')}
              />
            </div>

            <div>
              <span className="block text-xs font-medium text-[var(--text-muted)] mb-1">
                Date &amp; Received By
              </span>
              <span className="font-medium text-[var(--text-primary)] block pt-1.5">
                {formatLocalDate(data.createdOn)}
              </span>
              {data.createdBy && (
                <span className="text-xs text-[var(--text-muted)] block mt-0.5">
                  {tCommon('timeline.by', { actor: data.createdBy })}
                </span>
              )}
            </div>

            <div className="sm:col-span-2 lg:col-span-4">
              <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">
                {tCommon('columns.notes')}
              </label>
              <textarea
                className="input text-sm resize-y w-full"
                rows={2}
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                onBlur={() => handleSaveFields({ notes: editNotes })}
                disabled={isCancelled || saving}
                placeholder={t('placeholders.notes')}
              />
            </div>
          </div>
        </div>

        {/* Received Items Card */}
        <div className="card">
          <h3 className="section-heading mb-4 flex items-center gap-2">
            <span className="material-symbols-outlined shrink-0">inventory_2</span>
            <span>{t('flow.itemsReceived')}</span>
          </h3>
          <DataTable
            data={lines}
            keyExtractor={(l) => l.goodsReceivedLineId}
            columns={lineColumns}
            emptyMessage={t('flow.noItems')}
            mobileCard={(line, idx) => (
              <MobileLineItemCard
                title={
                  <Link href={routes.products.detail(line.productId)} className="hover:underline">
                    {line.productNumber || '—'}
                  </Link>
                }
                subtitle={line.productName || undefined}
                topRightBadge={`#${idx + 1}`}
                details={[
                  { label: t('columns.receivedQty'), value: parseFloat(line.quantityReceived || '0').toLocaleString(), isHighlighted: true },
                  {
                    label: t('columns.return.order'),
                    value: line.purchaseOrderId ? (
                      <Link href={routes.purchaseOrders.detail(line.purchaseOrderId)} className="text-[var(--accent)] font-medium">
                        {line.orderNumber ? line.orderNumber : t('columns.return.order')}
                      </Link>
                    ) : '—',
                  },
                  { label: t('columns.matchStatus'), value: line.matchStatus },
                  { label: 'Putaway', value: line.putawayStatus || '—' },
                ]}
              />
            )}
          />
        </div>

        {/* Activity Timeline Card */}
        <div className="card">
          <ActivityTimeline events={data.events || []} />
        </div>
      </div>

      {/* Allocation / PO Matching SlideOver */}
      <AllocationSlideOver
        isOpen={Boolean(selectedAllocationLine)}
        onClose={() => setSelectedAllocationLine(null)}
        grLines={selectedAllocationLine ? [selectedAllocationLine] : []}
        onRefresh={() => {
          setSelectedAllocationLine(null);
          fetchReception();
        }}
      />

      {/* Quarantine Modal */}
      <QuarantineModal
        isOpen={Boolean(quarantineLine)}
        onClose={() => setQuarantineLine(null)}
        onSubmit={handleQuarantineSubmit}
        locationId={data.locationId}
      />
    </DetailsLayout>
  );
}

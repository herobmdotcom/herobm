'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import SlideOver from '@/components/shared/SlideOver';
import { MobileCardField } from '@/components/shared/DataTable';
import { reportError } from '@/lib/api';
import * as api from '@modbm/sdk';
import { useTranslations } from 'next-intl';
import { MATCH_STATUS, PUTAWAY_STATUS } from '@modbm/shared';
import { toast } from 'react-hot-toast';
import { getErrorMessage } from '@modbm/shared';

interface AllocationSlideOverProps {
  isOpen: boolean;
  onClose: () => void;
  // modbm-allow-record-any
  grLines: Record<string, any>[];
  onRefresh: () => void;
}

/**
 * Per-line state: tracks the fetched PO candidates and which POs are expanded.
 */
interface LineState {
  pendingLines: any[];
  loading: boolean;
  expandedPOs: Set<string>;
  allocated: boolean; // true once successfully allocated
}

export default function AllocationSlideOver({ isOpen, onClose, grLines, onRefresh }: AllocationSlideOverProps) {
  const t = useTranslations('goodsReceived');
  const [lineStates, setLineStates] = useState<Map<string, LineState>>(new Map());
  const [activeLineId, setActiveLineId] = useState<string | null>(null);
  // modbm-allow-record-any
  const [localLines, setLocalLines] = useState<Record<string, any>[]>([]);
  // Track which line IDs have already been fetched to avoid the stale-closure race condition
  const fetchedRef = useRef<Set<string>>(new Set());

  // Initialize localLines when the slide-over opens
  useEffect(() => {
    if (isOpen) {
      // Only take lines that are currently unmatched AND not quarantined
      // ADV-086: Quarantined items must be cleared before matching
      const initialUnmatched = grLines.filter((l) => l.matchStatus !== MATCH_STATUS.MATCHED && l.putawayStatus !== PUTAWAY_STATUS.QUARANTINED);
      setLocalLines(initialUnmatched);
      if (initialUnmatched.length > 0) {
        setActiveLineId(initialUnmatched[0].goodsReceivedLineId);
      }
    } else {
      setLocalLines([]);
      setActiveLineId(null);
      setLineStates(new Map());
      fetchedRef.current = new Set();
    }
    // Intentionally only reacting to isOpen to prevent background grid refreshes from resetting the view
  }, [isOpen]);

  // We consider all localLines as our queue. Some might have been marked allocated via lineStates.
  const unmatchedLines = localLines;

  // Fetch pending POs for each line when localLines changes (we only fetch for those missing from lineStates)
  useEffect(() => {
    if (!isOpen || unmatchedLines.length === 0) return;

    for (const line of unmatchedLines) {
      // Skip if we already kicked off a fetch for this line
      if (fetchedRef.current.has(line.goodsReceivedLineId)) continue;
      fetchedRef.current.add(line.goodsReceivedLineId);

      // Initialize state for this line (loading placeholder)
      setLineStates((prev) => {
        const next = new Map(prev);
        next.set(line.goodsReceivedLineId, {
          pendingLines: [],
          loading: true,
          expandedPOs: new Set(),
          allocated: false,
        });
        return next;
      });

      api.purchaseOrdersControllerFindPendingLines({ 
        productId: line.productId, 
        vendorId: line.vendorId 
      })
        .then((data: any) => {
          const lines = Array.isArray(data) ? data : data.data || [];
          const poIds = [...new Set(lines.map((l: any) => l.purchaseOrderId))] as string[];

          setLineStates((prev) => {
            const next = new Map(prev);
            next.set(line.goodsReceivedLineId, {
              pendingLines: lines,
              loading: false,
              expandedPOs: new Set(poIds.length <= 3 ? poIds : poIds.length > 0 ? [poIds[0]] : []),
              allocated: false,
            });
            return next;
          });
        })
        .catch((err: any) => {
          reportError(err, 'AllocationSlideOver.pendingPOs');
          setLineStates((prev) => {
            const next = new Map(prev);
            next.set(line.goodsReceivedLineId, {
              pendingLines: [],
              loading: false,
              expandedPOs: new Set(),
              allocated: false,
            });
            return next;
          });
        });
    }
  }, [isOpen, unmatchedLines]);

  const toggleExpand = useCallback((lineId: string, poId: string) => {
    setLineStates((prev) => {
      const next = new Map(prev);
      const state = next.get(lineId);
      if (!state) return prev;
      const expanded = new Set(state.expandedPOs);
      if (expanded.has(poId)) expanded.delete(poId);
      else expanded.add(poId);
      next.set(lineId, { ...state, expandedPOs: expanded });
      return next;
    });
  }, []);

  const markAllocated = useCallback((lineId: string, allocatedQty: string, splitLine?: any) => {
    setLineStates((prev) => {
      const next = new Map(prev);
      const state = next.get(lineId);
      if (!state) return prev;
      next.set(lineId, { ...state, allocated: true });
      return next;
    });

    setLocalLines((prev) => {
      const idx = prev.findIndex(l => l.goodsReceivedLineId === lineId);
      if (idx === -1) return prev;

      const next = [...prev];
      // Update original line quantity to what was actually allocated
      next[idx] = { ...next[idx], quantityReceived: allocatedQty };

      let newActiveId = null;

      if (splitLine) {
        // Insert the split line right after the current line
        next.splice(idx + 1, 0, splitLine);
        // The split line becomes the new active line
        newActiveId = splitLine.goodsReceivedLineId;
      } else if (idx < next.length - 1) {
        // Auto-advance to the next line in the queue
        newActiveId = next[idx + 1].goodsReceivedLineId;
      }

      if (newActiveId) {
        setActiveLineId(newActiveId);
      }

      return next;
    });
  }, []);

  const handleAllocate = useCallback(async (grLine: any, poLine: any, qtyStr: string) => {
    const originalQuantity = parseFloat(grLine.quantityReceived || '0');
    const qty = parseFloat(qtyStr);
    if (isNaN(qty) || qty <= 0 || qty > originalQuantity) {
      toast.error(t('allocation.quantityValidationError', { max: originalQuantity }));
      return;
    }

    const hasLocationMismatch = poLine.deliveryLocationId && grLine.locationId && poLine.deliveryLocationId !== grLine.locationId;
    if (hasLocationMismatch) {
      if (!confirm(`Location Mismatch: This PO was destined for ${poLine.locationName || 'another location'}, but the goods were received here. Are you sure you want to proceed?`)) {
        return;
      }
    }

    try {
      const result = await api.goodsReceivedControllerResolveAllocation(grLine.goodsReceivedLineId, {
        purchaseOrderLineId: poLine.purchaseOrderLineId,
        allocatedQuantity: qtyStr,
      });
      // The API returns { success: true, splitLine: { ... } } if a split occurred
      const splitLineData = result?.data?.splitLine;
      
      let splitLine = null;
      if (splitLineData) {
        // Construct the new line using details from the original line
        splitLine = {
          ...grLine,
          goodsReceivedLineId: splitLineData.goodsReceivedLineId,
          quantityReceived: splitLineData.quantityReceived,
          matchStatus: splitLineData.matchStatus,
        };
      }

      markAllocated(grLine.goodsReceivedLineId, qtyStr, splitLine);
      onRefresh();
    } catch (err: unknown) {
      toast.error(getErrorMessage(err) || t('allocation.matchError'));
    }
  }, [onRefresh, markAllocated, t]);

  if (!isOpen || unmatchedLines.length === 0) return null;

  return (
    <SlideOver isOpen={isOpen} onClose={onClose} title={`Match Received Goods (${unmatchedLines.length} line${unmatchedLines.length > 1 ? 's' : ''})`} width="max-w-4xl">
      <div className="flex flex-col gap-6">

        {/* Summary Table */}
        <div className="card mb-0">
          <div className="hidden lg:block overflow-x-auto w-full">
            <table className="table-lines w-full">
              <thead>
                <tr>
                  <th>{t('columns.receiptNo')}</th>
                  <th>{t('columns.product')}</th>
                  <th>{t('columns.supplier')}</th>
                  <th style={{ textAlign: 'right' }}>{t('columns.receivedQty')}</th>
                  <th style={{ width: 90, textAlign: 'center' }}>{t('columns.status')}</th>
                </tr>
              </thead>
              <tbody>
                {unmatchedLines.map((line) => {
                  const state = lineStates.get(line.goodsReceivedLineId);
                  const isActive = activeLineId === line.goodsReceivedLineId;
                  return (
                    <tr 
                      key={line.goodsReceivedLineId}
                      onClick={() => setActiveLineId(line.goodsReceivedLineId)}
                      className={`cursor-pointer transition-colors ${isActive ? 'bg-[var(--bg-card-hover)] border-l-2 border-[var(--accent)]' : 'hover:bg-[var(--bg-card-hover)]/50 border-l-2 border-transparent'}`}
                    >
                      <td className="font-medium text-[var(--text-primary)]">{line.receiptNumber}</td>
                      <td>
                        <div className="font-semibold text-[var(--accent)]">{line.productNumber}</div>
                        <div className="text-xs text-[var(--text-muted)] mt-0.5">{line.productName}</div>
                      </td>
                      <td className="text-[var(--text-primary)]">{line.vendorName}</td>
                      <td className="text-right font-bold text-[var(--text-primary)] tabular-nums">
                        {parseFloat(line.quantityReceived || '0')}
                      </td>
                      <td className="text-center">
                        {state?.allocated ? (
                          <span className="badge badge-success">{t('status.allocated')}</span>
                        ) : (
                          <span className="text-xs text-[var(--text-muted)]">{t('status.pending')}</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="lg:hidden flex flex-col w-full gap-2 pt-2">
            {unmatchedLines.map((line) => {
              const state = lineStates.get(line.goodsReceivedLineId);
              const isActive = activeLineId === line.goodsReceivedLineId;
              return (
                <div
                  key={line.goodsReceivedLineId}
                  className={`transition-colors rounded-lg border p-3 flex flex-col shadow-sm ${isActive ? 'bg-[var(--bg-card-hover)] border-[var(--accent)]' : 'bg-[var(--bg-card)] border-[var(--border)]'}`}
                >
                  <div className="flex justify-between items-start gap-2 mb-2 cursor-pointer" onClick={() => setActiveLineId(line.goodsReceivedLineId)}>
                    <div className="font-semibold text-sm text-[var(--accent)]">
                      {line.productNumber || '—'}
                    </div>
                    <div className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded font-medium">
                      {line.receiptNumber}
                    </div>
                  </div>
                  <div className="text-sm text-[var(--text-primary)] font-medium mb-3 cursor-pointer" onClick={() => setActiveLineId(line.goodsReceivedLineId)}>
                    {line.productName || '—'}
                  </div>
                  <div className="flex flex-col gap-1 border-t border-[var(--border)] pt-2 cursor-pointer" onClick={() => setActiveLineId(line.goodsReceivedLineId)}>
                    <MobileCardField label={t('columns.supplier')} value={line.vendorName} />
                    <MobileCardField label={t('columns.receivedQty')} value={
                      <span className="font-bold tabular-nums">{parseFloat(line.quantityReceived || '0')}</span>
                    } />
                    <MobileCardField label={t('columns.status')} value={
                      state?.allocated ? (
                        <span className="badge badge-success">{t('status.allocated')}</span>
                      ) : (
                        <span className="text-xs text-[var(--text-muted)]">{t('status.pending')}</span>
                      )
                    } />
                  </div>
                  {isActive && state && !state.allocated && (
                    <div className="mt-4 pt-4 border-t border-[rgba(196,198,205,0.4)]">
                      <h4 className="text-xs font-bold mb-3 uppercase tracking-wider text-[var(--text-secondary)]">{t('allocation.eligiblePOs')}</h4>
                      <POCandidatesList grLine={line} state={state} toggleExpand={toggleExpand} handleAllocate={handleAllocate} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Per-line PO candidates */}
        <div className="hidden lg:block">
          {unmatchedLines.map((grLine) => {
            if (grLine.goodsReceivedLineId !== activeLineId) return null;
            
            const state = lineStates.get(grLine.goodsReceivedLineId);
            if (!state || state.allocated) return null;

            const originalQuantity = parseFloat(grLine.quantityReceived || '0');

            return (
              <div key={grLine.goodsReceivedLineId}>
                {/* Section header */}
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2 mb-4 p-3 bg-[var(--bg-card)] rounded-lg border border-[var(--border)] lg:border-none lg:p-0 lg:bg-transparent">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold text-[var(--accent)]">{grLine.productNumber}</span>
                    <span className="hidden lg:inline text-[var(--text-muted)]">—</span>
                    <span className="text-sm text-[var(--text-primary)] w-full lg:w-auto">{grLine.productName}</span>
                  </div>
                  
                  <div className="flex flex-wrap items-center justify-between lg:justify-end gap-4 mt-2 lg:mt-0 pt-2 lg:pt-0 border-t border-[var(--border)] lg:border-none w-full lg:w-auto">
                    <span className="text-xs text-[var(--text-secondary)]">
                      {t('allocation.receivedAt')} <span className="font-medium text-[var(--text-primary)]">{grLine.locationName || t('allocation.unknown')}</span>
                    </span>
                    <span className="text-xs font-semibold px-2 py-1 bg-[var(--bg-secondary)] rounded-md text-[var(--text-primary)] tabular-nums shrink-0">
                      {t('allocation.qty')} {originalQuantity}
                    </span>
                  </div>
                </div>

                <POCandidatesList grLine={grLine} state={state} toggleExpand={toggleExpand} handleAllocate={handleAllocate} />
              </div>
            );
          })}
        </div>

      </div>
    </SlideOver>
  );
}

function POCandidatesList({
  grLine,
  state,
  toggleExpand,
  handleAllocate
}: {
  grLine: any;
  state: any;
  toggleExpand: (lineId: string, poId: string) => void;
  handleAllocate: (grLine: any, poLine: any, qtyStr: string) => void;
}) {
  const t = useTranslations('goodsReceived');
  const originalQuantity = parseFloat(grLine.quantityReceived || '0');

  // Group pending lines by PO
  const poGroups = new Map<string, any>();
  for (const line of state.pendingLines) {
    if (!poGroups.has(line.purchaseOrderId)) {
      poGroups.set(line.purchaseOrderId, {
        purchaseOrderId: line.purchaseOrderId,
        orderNumber: line.orderNumber,
        locationName: line.locationName,
        lines: [],
      });
    }
    poGroups.get(line.purchaseOrderId)!.lines.push(line);
  }
  const groups = Array.from(poGroups.values());

  if (state.loading) {
    return (
      <div className="p-6 text-center text-[var(--text-muted)] border border-[var(--border)] rounded-md bg-[var(--bg-card)]">
        {t('allocation.loadingEligible')}
      </div>
    );
  }

  if (groups.length === 0) {
    return (
      <div className="p-6 text-center text-[var(--text-muted)] border border-[var(--border)] rounded-md bg-[var(--bg-card)]">
        {t('allocation.noPendingPOs')}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {groups.map((group) => {
        const isExpanded = state.expandedPOs.has(group.purchaseOrderId);
        return (
          <div key={group.purchaseOrderId} style={{ borderRadius: 8, border: '1px solid var(--border)', overflow: 'hidden', background: 'var(--bg-card)' }}>
            {/* Card Header */}
            <button
              onClick={() => toggleExpand(grLine.goodsReceivedLineId, group.purchaseOrderId)}
              style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {/* eslint-disable-next-line i18next/no-literal-string */}
                <span className="material-symbols-outlined" style={{ fontSize: 18, transition: 'transform 0.15s', transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)', color: 'var(--text-muted)' }}>
                  chevron_right
                </span>
                <span style={{ fontWeight: 700, color: 'var(--accent)', fontSize: 14 }}>
                  {group.orderNumber}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                {grLine.locationName && group.locationName && grLine.locationName !== group.locationName && (
                  <span className="badge badge-sm badge-warning">{t('allocation.locationMismatch')}</span>
                )}
                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                  {t('allocation.destination')} <span className="font-medium text-[var(--text-primary)]">{group.locationName || t('allocation.unknown')}</span>
                </div>
              </div>
            </button>

            {/* Expanded Lines */}
            {isExpanded && (
              <div style={{ borderTop: '1px solid var(--border)' }}>
                <div className="hidden lg:block overflow-x-auto">
                  <table className="table-lines w-full">
                    <thead>
                      <tr>
                        <th>{t('columns.ordered')}</th>
                        <th>{t('columns.received')}</th>
                        <th>{t('columns.remaining')}</th>
                        <th style={{ width: 160, textAlign: 'center' }}>{t('columns.allocate')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.lines.map((poLine: any) => (
                        <POLineRow
                          key={poLine.purchaseOrderLineId}
                          line={poLine}
                          originalQuantity={originalQuantity}
                          onAllocate={(qty) => handleAllocate(grLine, poLine, qty)}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="lg:hidden flex flex-col w-full divide-y divide-[var(--border)]">
                  {group.lines.map((poLine: any) => (
                    <POLineMobileCard
                      key={poLine.purchaseOrderLineId}
                      line={poLine}
                      originalQuantity={originalQuantity}
                      onAllocate={(qty) => handleAllocate(grLine, poLine, qty)}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function POLineRow({ line, originalQuantity, onAllocate }: { line: any; originalQuantity: number; onAllocate: (qty: string) => void }) {
  const t = useTranslations('goodsReceived');
  const ordered = parseFloat(line.quantity || '0');
  const received = parseFloat(line.quantityReceived || '0');
  const remaining = Math.max(0, ordered - received);

  const suggestedQty = Math.min(originalQuantity, remaining);
  const [qty, setQty] = useState(suggestedQty > 0 ? suggestedQty.toString() : originalQuantity.toString());
  const [isAllocating, setIsAllocating] = useState(false);

  return (
    <tr>
      <td className="tabular-nums">{ordered}</td>
      <td className="tabular-nums text-[var(--text-primary)]">{received}</td>
      <td className="tabular-nums font-bold text-[var(--text-primary)]">{remaining}</td>
      <td className="text-right">
        <div className="flex items-center justify-end gap-1">
          <input
            type="number"
            step="0.01"
            min="0.01"
            max={originalQuantity}
            className="input text-right"
            style={{ width: '70px', padding: '2px 4px', height: '26px', fontSize: '12px' }}
            value={qty}
            onChange={(e) => setQty(e.target.value)}
          />
          <button
            onClick={async () => {
              setIsAllocating(true);
              await onAllocate(qty);
              setIsAllocating(false);
            }}
            disabled={isAllocating || !qty}
            className="btn btn-primary btn-sm"
            style={{ padding: '2px 8px', height: '26px', fontSize: '11px' }}
          >
            {isAllocating ? t('allocation.allocating') : t('allocation.match')}
          </button>
        </div>
      </td>
    </tr>
  );
}

function POLineMobileCard({ line, originalQuantity, onAllocate }: { line: any; originalQuantity: number; onAllocate: (qty: string) => void }) {
  const t = useTranslations('goodsReceived');
  const ordered = parseFloat(line.quantity || '0');
  const received = parseFloat(line.quantityReceived || '0');
  const remaining = Math.max(0, ordered - received);

  const suggestedQty = Math.min(originalQuantity, remaining);
  const [qty, setQty] = useState(suggestedQty > 0 ? suggestedQty.toString() : originalQuantity.toString());
  const [isAllocating, setIsAllocating] = useState(false);

  return (
    <div className="flex flex-col gap-2 p-4 bg-[var(--bg-secondary)]">
      <div className="flex items-center justify-between gap-4">
        <MobileCardField className="flex-1 border-0 py-0" label={t('columns.ordered')} value={ordered} />
        <MobileCardField className="flex-1 border-0 py-0" label={t('columns.received')} value={received} />
      </div>
      <div className="flex flex-col gap-2 border-t border-[var(--border)] pt-3 mt-1">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-slate-500">{t('columns.remaining')}</span>
          <span className="text-sm font-bold text-[var(--text-primary)] tabular-nums">{remaining}</span>
        </div>
        <div className="flex items-center justify-end gap-2 mt-2">
          <input
            type="number"
            step="0.01"
            min="0.01"
            max={originalQuantity}
            className="input text-right"
            style={{ width: '80px', padding: '6px 8px', height: '32px', fontSize: '13px' }}
            value={qty}
            onChange={(e) => setQty(e.target.value)}
          />
          <button
            onClick={async () => {
              setIsAllocating(true);
              await onAllocate(qty);
              setIsAllocating(false);
            }}
            disabled={isAllocating || !qty}
            className="btn btn-primary"
            style={{ padding: '6px 16px', height: '32px', fontSize: '13px' }}
          >
            {isAllocating ? t('allocation.allocating') : t('allocation.match')}
          </button>
        </div>
      </div>
    </div>
  );
}

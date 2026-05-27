'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import SlideOver from '@/components/shared/SlideOver';
import { reportError } from '@/lib/api';
import * as api from '@modbm/sdk';
import { useTranslations } from 'next-intl';
import { MATCH_STATUS, PUTAWAY_STATUS } from '@modbm/shared';
import { toast } from 'react-hot-toast';

interface AllocationSlideOverProps {
  isOpen: boolean;
  onClose: () => void;
  grLines: any[];
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
  const [localLines, setLocalLines] = useState<any[]>([]);
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

      api.purchaseOrdersControllerFindPendingLines(line.productId)
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
      const result = await api.goodsReceivedControllerResolveAllocation(grLine.goodsReceivedLineId, { body: JSON.stringify({
        purchaseOrderLineId: poLine.purchaseOrderLineId,
        allocatedQuantity: qtyStr,
      }) }) as any;
      // The API returns { success: true, splitLine: { ... } } if a split occurred
      const splitLineData = result?.data?.splitLine || result?.splitLine;
      
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
    } catch (err: any) {
      toast.error(err.message || t('allocation.matchError'));
    }
  }, [onRefresh, markAllocated, t]);

  if (!isOpen || unmatchedLines.length === 0) return null;

  return (
    <SlideOver isOpen={isOpen} onClose={onClose} title={`Match Received Goods (${unmatchedLines.length} line${unmatchedLines.length > 1 ? 's' : ''})`} width="max-w-4xl">
      <div className="flex flex-col gap-6">

        {/* Summary Table */}
        <div className="card mb-0">
          <table className="table-lines">
            <thead>
              <tr>
                <th>{t('columns.receiptNo')}</th>
                <th>{t('columns.product')}</th>
                <th>{t('columns.supplier')}</th>
                <th style={{ textAlign: 'right' }}>{t('columns.receivedQty', { fallback: 'Received Qty' })}</th>
                <th style={{ width: 90, textAlign: 'center' }}>{t('columns.status', { fallback: 'Status' })}</th>
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

        {/* Per-line PO candidates */}
        {unmatchedLines.map((grLine) => {
          if (grLine.goodsReceivedLineId !== activeLineId) return null;
          
          const state = lineStates.get(grLine.goodsReceivedLineId);
          if (!state || state.allocated) return null;

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

          return (
            <div key={grLine.goodsReceivedLineId}>
              {/* Section header */}
              <div className="flex items-center gap-2 mb-2">
                <span className="font-bold text-[var(--accent)]">{grLine.productNumber}</span>
                <span className="text-[var(--text-muted)]">—</span>
                <span className="text-sm text-[var(--text-primary)]">{grLine.productName}</span>
                
                <span className="text-xs ml-4 text-[var(--text-secondary)]">
                  {t('allocation.receivedAt')} <span className="font-medium text-[var(--text-primary)]">{grLine.locationName || t('allocation.unknown')}</span>
                </span>

                <span className="text-xs text-[var(--text-muted)] ml-auto tabular-nums">
                  {t('allocation.qty')} {originalQuantity}
                </span>
              </div>

              {/* PO Cards */}
              {state.loading ? (
                <div className="p-6 text-center text-[var(--text-muted)] border border-[var(--border)] rounded-md bg-[var(--bg-card)]">
                  {t('allocation.loadingEligible')}
                </div>
              ) : groups.length === 0 ? (
                <div className="p-6 text-center text-[var(--text-muted)] border border-[var(--border)] rounded-md bg-[var(--bg-card)]">
                  {t('allocation.noPendingPOs')}
                </div>
              ) : (
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
                            <table className="table-lines">
                              <thead>
                                <tr>
                                  <th>{t('columns.ordered', { fallback: 'Ordered' })}</th>
                                  <th>{t('columns.received', { fallback: 'Received' })}</th>
                                  <th>{t('columns.remaining', { fallback: 'Remaining' })}</th>
                                  <th style={{ width: 160, textAlign: 'center' }}>{t('columns.allocate', { fallback: 'Allocate' })}</th>
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
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

      </div>
    </SlideOver>
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

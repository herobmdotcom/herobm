'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import SlideOver from '@/components/shared/SlideOver';
import { reportError } from '@/lib/api';
import * as api from '@herobm/sdk';
import { useTranslations } from 'next-intl';
import { toast } from 'react-hot-toast';
import { getErrorMessage } from '@herobm/shared';
import { Button } from '@/components/shared/Button';

interface LinkToPOSlideOverProps {
  isOpen: boolean;
  onClose: () => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- External API integration boundaries where exact types are unknown.
  demands: Record<string, any>[];
  onRefresh: () => void;
}

/**
 * Per-line state: tracks the fetched PO candidates and which POs are expanded.
 */
interface DemandState {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- External API integration boundaries where exact types are unknown.
  pendingLines: any[];
  loading: boolean;
  expandedPOs: Set<string>;
  allocated: boolean; // true once successfully allocated
}

export default function LinkToPOSlideOver({ isOpen, onClose, demands, onRefresh }: LinkToPOSlideOverProps) {
  const t = useTranslations('purchaseOrders');
  const [demandStates, setDemandStates] = useState<Map<string, DemandState>>(new Map());
  const [activeDemandId, setActiveDemandId] = useState<string | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- External API integration boundaries where exact types are unknown.
  const [localDemands, setLocalDemands] = useState<Record<string, any>[]>([]);
  // Track which demand IDs have already been fetched to avoid the stale-closure race condition
  const fetchedRef = useRef<Set<string>>(new Set());

  // Initialize localDemands when the slide-over opens
  useEffect(() => {
    if (isOpen) {
      setLocalDemands(demands);
      if (demands.length > 0) {
        setActiveDemandId(demands[0].id);
      }
    } else {
      setLocalDemands([]);
      setActiveDemandId(null);
      setDemandStates(new Map());
      fetchedRef.current = new Set();
    }
  }, [isOpen]);

  const unmatchedDemands = localDemands;

  // Fetch pending POs for each demand when localDemands changes
  useEffect(() => {
    if (!isOpen || unmatchedDemands.length === 0) return;

    for (const demand of unmatchedDemands) {
      // Skip if we already kicked off a fetch for this demand
      if (fetchedRef.current.has(demand.id)) continue;
      fetchedRef.current.add(demand.id);

      // Initialize state for this demand (loading placeholder)
      setDemandStates((prev) => {
        const next = new Map(prev);
        next.set(demand.id, {
          pendingLines: [],
          loading: true,
          expandedPOs: new Set(),
          allocated: false,
        });
        return next;
      });

      api.allocationsControllerGetAvailablePoLines({ productId: demand.productId })
        .then((res) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any -- External API integration boundaries where exact types are unknown.
          const lines = (res.data as any)?.data || [];
          // eslint-disable-next-line @typescript-eslint/no-explicit-any -- External API integration boundaries where exact types are unknown.
          const poIds = [...new Set(lines.map((l: any) => l.purchaseOrderId))] as string[];

          setDemandStates((prev) => {
            const next = new Map(prev);
            next.set(demand.id, {
              pendingLines: lines,
              loading: false,
              expandedPOs: new Set(poIds.length <= 3 ? poIds : poIds.length > 0 ? [poIds[0]] : []),
              allocated: false,
            });
            return next;
          });
        })
        .catch((err) => {
          reportError(err, 'LinkToPOSlideOver.availablePOLines');
          setDemandStates((prev) => {
            const next = new Map(prev);
            next.set(demand.id, {
              pendingLines: [],
              loading: false,
              expandedPOs: new Set(),
              allocated: false,
            });
            return next;
          });
        });
    }
  }, [isOpen, unmatchedDemands]);

  const toggleExpand = useCallback((demandId: string, poId: string) => {
    setDemandStates((prev) => {
      const next = new Map(prev);
      const state = next.get(demandId);
      if (!state) return prev;
      const expanded = new Set(state.expandedPOs);
      if (expanded.has(poId)) expanded.delete(poId);
      else expanded.add(poId);
      next.set(demandId, { ...state, expandedPOs: expanded });
      return next;
    });
  }, []);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- External API integration boundaries where exact types are unknown.
  const markAllocated = useCallback((demandId: string, splitDemand?: any) => {
    setDemandStates((prev) => {
      const next = new Map(prev);
      const state = next.get(demandId);
      if (!state) return prev;
      next.set(demandId, { ...state, allocated: true });
      return next;
    });

    setLocalDemands((prev) => {
      if (splitDemand) {
        // Find where the current demand is and insert the split demand right after it
        const idx = prev.findIndex(d => d.id === demandId);
        if (idx >= 0) {
          const next = [...prev];
          next.splice(idx + 1, 0, splitDemand);
          return next;
        }
        return [...prev, splitDemand];
      }
      return prev;
    });

    // Auto-advance to the next unallocated demand
    setLocalDemands((prev) => {
      const currentIndex = prev.findIndex(d => d.id === demandId);
      if (currentIndex >= 0 && currentIndex < prev.length - 1) {
        // Since we might have just inserted the split line at currentIndex + 1, it will become active!
        setActiveDemandId(prev[currentIndex + 1].id);
      }
      return prev;
    });
  }, []);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- External API integration boundaries where exact types are unknown.
  const handleAllocate = useCallback(async (demand: any, poLine: any, qtyStr: string) => {
    const originalQuantity = parseFloat(demand.quantity || '0');
    const qty = parseFloat(qtyStr);
    if (isNaN(qty) || qty <= 0 || qty > originalQuantity) {
      toast.error(t('demands.quantityValidationError', { max: originalQuantity }));
      return;
    }

    try {
      await api.allocationsControllerLinkDemandToPo({
        demandId: demand.id,
        purchaseOrderLineId: poLine.purchaseOrderLineId,
        quantity: qty.toString(),
      });
      
      let splitDemand = null;
      if (qty < originalQuantity) {
        const remainingQty = originalQuantity - qty;
        // Construct the new line using details from the original line,
        // we'll spoof an ID for the frontend state queue
        splitDemand = {
          ...demand,
          id: `${demand.id}-split-${Date.now()}`,
          quantity: remainingQty,
        };
      }

      markAllocated(demand.id, splitDemand);
      onRefresh();
    } catch (err: unknown) {
      toast.error(getErrorMessage(err) || t('demands.allocationError'));
    }
  }, [onRefresh, markAllocated, t]);

  if (!isOpen || unmatchedDemands.length === 0) return null;

  return (
    <SlideOver isOpen={isOpen} onClose={onClose} title={`Allocate Demand to PO (${unmatchedDemands.length} line${unmatchedDemands.length > 1 ? 's' : ''})`} width="max-w-4xl">
      <div className="flex flex-col gap-6">

        {/* Summary Table */}
        <div className="card mb-0">
          <table className="table-lines">
            <thead>
              <tr>
                <th>{t('demands.salesOrder')}</th>
                <th>{t('demands.product')}</th>
                <th className="text-right">{t('demands.reqQty')}</th>
                <th className="w-[90px] text-center">{t('demands.status')}</th>
              </tr>
            </thead>
            <tbody>
              {unmatchedDemands.map((demand) => {
                const state = demandStates.get(demand.id);
                const isActive = activeDemandId === demand.id;
                return (
                  <tr 
                    key={demand.id}
                    onClick={() => setActiveDemandId(demand.id)}
                    className={`cursor-pointer transition-colors ${isActive ? 'bg-[var(--bg-card-hover)] border-l-2 border-[var(--accent)]' : 'hover:bg-[var(--bg-card-hover)]/50 border-l-2 border-transparent'}`}
                  >
                    <td className="font-medium text-[var(--text-primary)]">{demand.orderNumber}</td>
                    <td>
                      <div className="font-semibold text-[var(--accent)]">{demand.productName}</div>
                      <div className="text-xs text-[var(--text-muted)] mt-0.5">{demand.productDescription}</div>
                    </td>
                    <td className="text-right font-bold text-[var(--text-primary)] tabular-nums">
                      {parseFloat(demand.quantity || '0')}
                    </td>
                    <td className="text-center">
                      {state?.allocated ? (
                        <span className="badge badge-success">{t('demands.linked')}</span>
                      ) : (
                        <span className="text-xs text-[var(--text-muted)]">{t('demands.pending')}</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Per-line PO candidates */}
        {unmatchedDemands.map((demand) => {
          if (demand.id !== activeDemandId) return null;
          
          const state = demandStates.get(demand.id);
          if (!state || state.allocated) return null;

          const originalQuantity = parseFloat(demand.quantity || '0');

          // Group pending lines by PO
          // eslint-disable-next-line @typescript-eslint/no-explicit-any -- External API integration boundaries where exact types are unknown.
          const poGroups = new Map<string, any>();
          for (const line of state.pendingLines) {
            if (!poGroups.has(line.purchaseOrderId)) {
              poGroups.set(line.purchaseOrderId, {
                purchaseOrderId: line.purchaseOrderId,
                orderNumber: line.orderNumber,
                vendorName: line.vendorName,
                locationName: line.locationName,
                stateCode: line.stateCode,
                lines: [],
              });
            }
            poGroups.get(line.purchaseOrderId)!.lines.push(line);
          }
          const groups = Array.from(poGroups.values());

          return (
            <div key={demand.id}>
              {/* Section header */}
              <div className="flex items-center gap-2 mb-2">
                <span className="font-bold text-[var(--accent)]">{demand.productName}</span>
                <span className="text-[var(--text-muted)]">—</span>
                <span className="text-sm text-[var(--text-primary)]">{demand.orderNumber}</span>
                
                <span className="text-xs ml-4 text-[var(--text-secondary)]">
                  {t('demands.requiredAt')} <span className="font-medium text-[var(--text-primary)]">{demand.locationName || t('demands.unknown')}</span>
                </span>

                <span className="text-xs text-[var(--text-muted)] ml-auto tabular-nums">
                  {t('demands.qtyRequired')} {originalQuantity}
                </span>
              </div>

              {/* PO Cards */}
              {state.loading ? (
                <div className="p-6 text-center text-[var(--text-muted)] border border-[var(--border)] rounded-md bg-[var(--bg-card)]">
                  {t('demands.loadingEligible')}
                </div>
              ) : groups.length === 0 ? (
                <div className="p-6 text-center text-[var(--text-muted)] border border-[var(--border)] rounded-md bg-[var(--bg-card)]">
                  {t('demands.noOpenPos')}
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {groups.map((group) => {
                    const isExpanded = state.expandedPOs.has(group.purchaseOrderId);
                    return (
                      <div key={group.purchaseOrderId} className="rounded-lg border border-[var(--border)] overflow-hidden bg-[var(--bg-card)]">
                        {/* Card Header */}
                        <Button variant="ghost"
                          onClick={() => toggleExpand(demand.id, group.purchaseOrderId)}
                          className="w-full flex items-center justify-between px-4 py-2.5 bg-transparent border-none cursor-pointer text-left"
                        >
                          <div className="flex items-center gap-2">
                            <span className={`material-symbols-outlined text-[18px] transition-transform duration-150 text-[var(--text-muted)] ${isExpanded ? 'rotate-90' : 'rotate-0'}`}>
                              chevron_right
                            </span>
                            <span className="font-bold text-[var(--accent)] text-sm">
                              {group.orderNumber}
                            </span>
                            <span className="badge badge-legacy">{group.stateCode}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            {demand.locationName && group.locationName && demand.locationName !== group.locationName && (
                              <span className="badge badge-sm badge-warning">{t('demands.locationMismatch')}</span>
                            )}
                            <div className="text-[13px] text-[var(--text-muted)]">
                              <span className="font-medium text-[var(--text-primary)]">{group.vendorName}</span>
                              {' • '}
                              {t('demands.destination')} <span className="font-medium text-[var(--text-primary)]">{group.locationName || t('demands.unknown')}</span>
                            </div>
                          </div>
                        </Button>

                        {/* Expanded Lines */}
                        {isExpanded && (
                          <div className="border-t border-[var(--border)]">
                            <table className="table-lines">
                              <thead>
                                <tr>
                                  <th>{t('demands.ordered')}</th>
                                  <th>{t('demands.availableCap')}</th>
                                  <th className="w-[160px] text-center">{t('demands.link')}</th>
                                </tr>
                              </thead>
                              <tbody>
                                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any -- External API integration boundaries where exact types are unknown. */}
                                {group.lines.map((poLine: any) => (
                                  <POLineRow
                                    key={poLine.purchaseOrderLineId}
                                    poLine={poLine}
                                    originalQuantity={originalQuantity}
                                    onAllocate={(qty) => handleAllocate(demand.id, poLine.purchaseOrderLineId, qty)}
                                    t={t}
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

function POLineRow({ poLine, originalQuantity, onAllocate, t }: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- External API integration boundaries where exact types are unknown.
  poLine: any;
  originalQuantity: number;
  onAllocate: (qty: string) => Promise<void>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- next-intl TFunction types mismatch with Record
  t: any;
}) {
  const ordered = parseFloat(poLine.quantity || '0');
  const allocated = parseFloat(poLine.allocatedQuantity || '0');
  const available = Math.max(0, ordered - allocated);

  const [qty, setQty] = useState(Math.min(originalQuantity, available).toString());
  const [isAllocating, setIsAllocating] = useState(false);

  return (
    <tr>
      <td className="tabular-nums text-[var(--text-primary)]">{ordered}</td>
      <td className="tabular-nums font-bold text-[var(--text-primary)]">{available}</td>
      <td className="text-right">
        <div className="flex items-center justify-end gap-1">
          <input
            type="number"
            step="0.01"
            min="0.01"
            max={originalQuantity}
            className="input text-right w-[70px] px-1 py-0.5 h-[26px] text-xs"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
          />
          <Button
            onClick={async () => {
              setIsAllocating(true);
              await onAllocate(qty);
              setIsAllocating(false);
            }}
            disabled={isAllocating || !qty || parseFloat(qty) > available}
            variant="primary" size="sm"
            className="px-2 py-0.5 h-[26px] text-[11px]"
          >
            {isAllocating ? t('demands.allocating') : t('demands.allocate')}
          </Button>
        </div>
      </td>
    </tr>
  );
}

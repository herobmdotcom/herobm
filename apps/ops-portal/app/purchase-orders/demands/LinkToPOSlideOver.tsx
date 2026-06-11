'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import SlideOver from '@/components/shared/SlideOver';
import { reportError } from '@/lib/api';
import * as api from '@modbm/sdk';
import { useTranslations } from 'next-intl';
import { toast } from 'react-hot-toast';
import { getErrorMessage } from '@modbm/shared';

interface LinkToPOSlideOverProps {
  isOpen: boolean;
  onClose: () => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  demands: Record<string, any>[];
  onRefresh: () => void;
}

/**
 * Per-line state: tracks the fetched PO candidates and which POs are expanded.
 */
interface DemandState {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  pendingLines: any[];
  loading: boolean;
  expandedPOs: Set<string>;
  allocated: boolean; // true once successfully allocated
}

export default function LinkToPOSlideOver({ isOpen, onClose, demands, onRefresh }: LinkToPOSlideOverProps) {
  const t = useTranslations('purchaseOrders');
  const [demandStates, setDemandStates] = useState<Map<string, DemandState>>(new Map());
  const [activeDemandId, setActiveDemandId] = useState<string | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const lines = (res.data as any)?.data || [];
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
                <th style={{ textAlign: 'right' }}>{t('demands.reqQty')}</th>
                <th style={{ width: 90, textAlign: 'center' }}>{t('demands.status')}</th>
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
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
                      <div key={group.purchaseOrderId} style={{ borderRadius: 8, border: '1px solid var(--border)', overflow: 'hidden', background: 'var(--bg-card)' }}>
                        {/* Card Header */}
                        <button
                          onClick={() => toggleExpand(demand.id, group.purchaseOrderId)}
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
                            <span className="badge badge-legacy">{group.stateCode}</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            {demand.locationName && group.locationName && demand.locationName !== group.locationName && (
                              <span className="badge badge-sm badge-warning">{t('demands.locationMismatch')}</span>
                            )}
                            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                              <span className="font-medium text-[var(--text-primary)]">{group.vendorName}</span>
                              {' • '}
                              {t('demands.destination')} <span className="font-medium text-[var(--text-primary)]">{group.locationName || t('demands.unknown')}</span>
                            </div>
                          </div>
                        </button>

                        {/* Expanded Lines */}
                        {isExpanded && (
                          <div style={{ borderTop: '1px solid var(--border)' }}>
                            <table className="table-lines">
                              <thead>
                                <tr>
                                  <th>{t('demands.ordered')}</th>
                                  <th>{t('demands.availableCap')}</th>
                                  <th style={{ width: 160, textAlign: 'center' }}>{t('demands.link')}</th>
                                </tr>
                              </thead>
                              <tbody>
                                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                                {group.lines.map((poLine: any) => (
                                  <POLineRow
                                    key={poLine.purchaseOrderLineId}
                                    line={poLine}
                                    originalQuantity={originalQuantity}
                                    onAllocate={(qty) => handleAllocate(demand, poLine, qty)}
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function POLineRow({ line, originalQuantity, onAllocate }: { line: any; originalQuantity: number; onAllocate: (qty: string) => void }) {
  const t = useTranslations('purchaseOrders');
  const ordered = parseFloat(line.quantity || '0');
  const available = parseFloat(line.availableQty || '0');

  const suggestedQty = Math.min(originalQuantity, available);
  const [qty, setQty] = useState(suggestedQty > 0 ? suggestedQty.toString() : originalQuantity.toString());
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
            disabled={isAllocating || !qty || parseFloat(qty) > available}
            className="btn btn-primary btn-sm"
            style={{ padding: '2px 8px', height: '26px', fontSize: '11px' }}
          >
            {isAllocating ? t('demands.allocating') : t('demands.allocate')}
          </button>
        </div>
      </td>
    </tr>
  );
}

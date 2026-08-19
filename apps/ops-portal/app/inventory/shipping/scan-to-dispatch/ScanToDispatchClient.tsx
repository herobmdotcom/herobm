'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { ContentPageHeader } from '@/components/shared/ContentPageHeader';
import { Button } from '@/components/shared/Button';
import InlineAlert from '@/components/shared/InlineAlert';
import * as api from '@herobm/sdk';
import { reportError } from '@/lib/api';
import { getErrorMessage, SHIPMENT_STATE, SALES_ORDER_PICK_STATE, parsePickBarcode } from '@herobm/shared';
import { toast } from 'react-hot-toast';
import PickingOrderLinesView, { PickingLine, PickAllocation } from '@/app/inventory/components/PickingOrderLinesView';

interface ScannedLine {
  scanId: string;
  orderId: string;
  lineId: string;
  binId: string;
  quantity: string;
  scannedAt: Date;
  status: 'picked' | 'error';
  errorMessage?: string;
}

interface OrderSummary {
  orderId: string;
  orderNumber: string;
  customerName: string;
  totalLines: number;
  pickedLinesCount: number;
  fullyPickedLinesCount: number;
  isFullyPicked: boolean;
  isAllAvailablePicked: boolean;
  canShip: boolean;
  lines: PickingLine[];
  picks: PickAllocation[];
  scannedLines: ScannedLine[];
  lastScannedAt: Date;
}

export default function ScanToDispatchClient() {
  const t = useTranslations('scanToDispatch');
  useDocumentTitle(t('title'));

  const [barcodeInput, setBarcodeInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [ordersMap, setOrdersMap] = useState<Record<string, OrderSummary>>({});
  const [expandedOrders, setExpandedOrders] = useState<Record<string, boolean>>({});
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
    detail?: string;
  } | null>(null);
  const [dispatchingOrderId, setDispatchingOrderId] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  // Keep input focused for hardware barcode scanners
  useEffect(() => {
    inputRef.current?.focus();
    const handleWindowClick = () => {
      inputRef.current?.focus();
    };
    window.addEventListener('click', handleWindowClick);
    return () => window.removeEventListener('click', handleWindowClick);
  }, []);

  const playBeep = useCallback((success: boolean) => {
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      if (success) {
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        osc.start();
        osc.stop(ctx.currentTime + 0.12);
      } else {
        osc.frequency.setValueAtTime(220, ctx.currentTime);
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        osc.start();
        osc.stop(ctx.currentTime + 0.28);
      }
    } catch {
      // Audio context may require prior interaction
    }
  }, []);

  const refreshOrderSummary = useCallback(async (orderId: string, lineToAdd?: ScannedLine) => {
    try {
      const res = await api.orderPickingControllerGetPickingSummary(orderId);
      const summary = res.data;
      if (!summary) return;

      const orderInfo = await api.ordersControllerFindOne(orderId).catch(() => null);
      const orderData = orderInfo?.data as { orderNumber?: string; customerName?: string } | undefined;

      const summaryLines = ((summary.lines || []) as unknown) as PickingLine[];
      const summaryPicks = ((summary.picks || []) as unknown) as PickAllocation[];

      const activePhysicalLines = summaryLines.filter((l) => (l.isPhysical ?? l.isStocked ?? true));
      const totalLines = Math.max(activePhysicalLines.length, summary.totalLines ?? 0, summaryLines.length, 1);

      // Find all line IDs that have any picked quantity (from lines or picks)
      const pickedLineIds = new Set<string>();

      activePhysicalLines.forEach((l) => {
        if (parseFloat(String(l.quantityPicked || '0')) > 0 || l.isFullyPicked) {
          pickedLineIds.add(l.salesOrderLineId);
        }
      });

      summaryPicks.forEach((p) => {
        if (p.stateCode === SALES_ORDER_PICK_STATE.PICKED && parseFloat(String(p.quantity || '0')) > 0) {
          pickedLineIds.add(p.salesOrderLineId);
        }
      });

      const pickedLinesCount = pickedLineIds.size;

      // Fully picked lines
      const fullyPickedLinesCount = summary.fullyPickedLines ?? activePhysicalLines.filter((l) => l.isFullyPicked).length;
      const isFullyPicked = Boolean(summary.isFullyPicked || (totalLines > 0 && fullyPickedLinesCount >= totalLines));

      // Check if all unpicked lines are out of stock
      const unpickedLines = activePhysicalLines.filter((l) => !l.isFullyPicked && !pickedLineIds.has(l.salesOrderLineId));
      const hasUnpickableRemaining = unpickedLines.length > 0 && unpickedLines.every(
        (l) => !l.availableBins || l.availableBins.length === 0 || parseFloat(String(l.onHand || 0)) <= 0
      );

      const canShip = pickedLinesCount > 0 || summaryPicks.some((p) => p.stateCode === SALES_ORDER_PICK_STATE.PICKED && parseFloat(String(p.quantity || '0')) > 0);
      const isAllAvailablePicked = isFullyPicked || (canShip && (hasUnpickableRemaining || unpickedLines.length === 0));

      setOrdersMap((prev) => {
        const existing = prev[orderId];
        const existingLines = existing ? existing.scannedLines : [];
        const newLines = lineToAdd
          ? [lineToAdd, ...existingLines.filter((l) => l.scanId !== lineToAdd.scanId)]
          : existingLines;

        return {
          ...prev,
          [orderId]: {
            orderId,
            orderNumber: orderData?.orderNumber || orderId.slice(0, 8),
            customerName: orderData?.customerName || '',
            totalLines,
            pickedLinesCount,
            fullyPickedLinesCount,
            isFullyPicked,
            isAllAvailablePicked,
            canShip,
            lines: summaryLines,
            picks: summaryPicks,
            scannedLines: newLines,
            lastScannedAt: new Date(),
          },
        };
      });
    } catch (err) {
      reportError(err, 'Failed to fetch order summary');
    }
  }, []);

  const processBarcode = async (rawCode: string) => {
    const code = rawCode.trim();
    if (!code) return;

    setIsProcessing(true);
    setBarcodeInput('');

    try {
      const parsed = parsePickBarcode(code);
      if (!parsed) {
        throw new Error('Invalid barcode format. Expected: PICK:{orderId}:{lineId}:{binId}:{quantity}');
      }

      const { orderId, lineId, binId, quantity } = parsed;

      // 1. Call pickLine API
      await api.orderPickingControllerPickLine(orderId, lineId, {
        binId,
        quantity,
      });

      playBeep(true);

      const scannedItem: ScannedLine = {
        scanId: `${orderId}-${lineId}-${Date.now()}`,
        orderId,
        lineId,
        binId,
        quantity,
        scannedAt: new Date(),
        status: 'picked',
      };

      setFeedback({
        type: 'success',
        message: t('pickedQty', { quantity }),
        detail: t('pickedQtyDetail', { lineId: lineId.slice(0, 8), binId: binId.slice(0, 8) }),
      });

      await refreshOrderSummary(orderId, scannedItem);
    } catch (err: unknown) {
      playBeep(false);
      const errMsg = getErrorMessage(err);
      setFeedback({
        type: 'error',
        message: t('scanFailed'),
        detail: errMsg,
      });
      toast.error(errMsg);
    } finally {
      setIsProcessing(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      processBarcode(barcodeInput);
    }
  };

  const handleDispatchOrder = async (orderId: string) => {
    const order = ordersMap[orderId];
    if (!order) return;

    setDispatchingOrderId(orderId);
    try {
      const contextRes = await api.orderPickingControllerGetShippingContext(orderId);
      const context = contextRes.data;

      const linesToShip = context?.lines
        ?.filter((l) => parseFloat(l.availableToShip) > 0 && l.isPhysical)
        .map((l) => ({
          salesOrderLineId: l.salesOrderLineId,
          quantityShipped: l.availableToShip,
        })) || [];

      if (linesToShip.length === 0) {
        throw new Error('No items available to ship on this order.');
      }

      // 1. Create Shipment
      const shipmentRes = await api.orderShipmentsControllerCreateShipment(orderId, {
        lines: linesToShip,
      });

      const shipmentId = shipmentRes.data?.shipmentId;
      if (!shipmentId) {
        throw new Error('Shipment ID missing from response.');
      }

      // 2. Change Shipment State to Dispatched
      await api.orderShipmentsControllerChangeShipmentState(orderId, shipmentId, {
        stateCode: SHIPMENT_STATE.DISPATCHED,
      });

      playBeep(true);
      toast.success(t('orderDispatchedToast', { orderNumber: order.orderNumber }));

      // Remove dispatched order from map
      setOrdersMap((prev) => {
        const next = { ...prev };
        delete next[orderId];
        return next;
      });

      setFeedback({
        type: 'success',
        message: t('orderDispatched', { orderNumber: order.orderNumber }),
        detail: t('orderDispatchedDetail', { shipmentNumber: shipmentRes.data?.shipmentNumber || '' }),
      });
    } catch (err: unknown) {
      playBeep(false);
      const errMsg = getErrorMessage(err);
      toast.error(errMsg);
      setFeedback({
        type: 'error',
        message: t('dispatchFailed'),
        detail: errMsg,
      });
    } finally {
      setDispatchingOrderId(null);
      inputRef.current?.focus();
    }
  };

  const handleCancelPick = async (orderId: string, pickId: string) => {
    try {
      await api.orderPickingControllerCancelPick(orderId, pickId);
      playBeep(true);
      toast.success(t('pickCancelled'));
      await refreshOrderSummary(orderId);
    } catch (err: unknown) {
      playBeep(false);
      const errMsg = getErrorMessage(err);
      toast.error(errMsg);
    } finally {
      inputRef.current?.focus();
    }
  };

  const toggleOrderExpand = (orderId: string) => {
    setExpandedOrders((prev) => {
      const currentlyExpanded = prev[orderId] ?? true;
      return {
        ...prev,
        [orderId]: !currentlyExpanded,
      };
    });
  };

  const activeOrdersList = useMemo(() => {
    return Object.values(ordersMap).sort(
      (a, b) => b.lastScannedAt.getTime() - a.lastScannedAt.getTime()
    );
  }, [ordersMap]);

  return (
    <div className="flex flex-col flex-1 h-full p-4 lg:p-6 overflow-y-auto max-w-7xl mx-auto w-full">
      {/* Standard Header */}
      <ContentPageHeader title={t('title')} />

      <div className="flex flex-col gap-6 w-full">
        {/* Scanner Input Card */}
        <div className="p-6 rounded-xl border border-[var(--border)] bg-[var(--bg-card)]">
          <div className="flex items-center justify-between mb-3">
            <label htmlFor="scanner-input" className="text-sm font-semibold flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              {t('scannerActive')}
            </label>
            {isProcessing && (
              <span className="text-xs text-[var(--accent)] flex items-center gap-1">
                {/* eslint-disable-next-line i18next/no-literal-string -- Material UI Icon */}
                <span className="material-symbols-outlined text-sm animate-spin">refresh</span>
                {t('processing')}
              </span>
            )}
          </div>

          <div className="relative">
            <input
              id="scanner-input"
              ref={inputRef}
              type="text"
              value={barcodeInput}
              onChange={(e) => setBarcodeInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t('placeholder')}
              className="w-full px-4 py-3 text-base rounded-lg border border-[var(--border)] bg-[var(--bg-input)] text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] transition-all font-mono"
              autoComplete="off"
              disabled={isProcessing}
            />
            <div className="absolute right-3 top-3.5 text-xs text-[var(--text-muted)] pointer-events-none">
              {t('autoFocusOn')}
            </div>
          </div>

          {/* Live Feedback Banner */}
          {feedback && (
            <div className="mt-4">
              <InlineAlert
                type={feedback.type === 'success' ? 'info' : 'error'}
                message={
                  <div>
                    <div className="font-bold">{feedback.message}</div>
                    {feedback.detail && <div className="text-xs mt-0.5">{feedback.detail}</div>}
                  </div>
                }
              />
            </div>
          )}
        </div>

        {/* Active Orders List */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-[var(--text-primary)]">
              {t('activeOrdersCount', { count: activeOrdersList.length })}
            </h2>
          </div>

          {activeOrdersList.length === 0 ? (
            <div className="p-12 rounded-xl border border-dashed border-[var(--border)] bg-[var(--bg-card)] text-center text-[var(--text-muted)]">
              <span className="material-symbols-outlined text-4xl mb-2 opacity-50">qr_code_scanner</span>
              <p className="text-sm">{t('emptyPrompt')}</p>
            </div>
          ) : (
            activeOrdersList.map((order) => {
              const isExpanded = expandedOrders[order.orderId] ?? true;
              const isDispatching = dispatchingOrderId === order.orderId;

              return (
                <div
                  key={order.orderId}
                  className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-5 flex flex-col gap-4 transition-all"
                >
                  {/* Order Card Header */}
                  <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--border)] pb-4">
                    <div className="flex items-center gap-3">
                      <div>
                        <div className="flex items-center gap-2.5">
                          <h3 className="text-lg font-bold text-[var(--text-primary)]">
                            {order.orderNumber}
                          </h3>
                          {order.isFullyPicked ? (
                            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[var(--bg-secondary)] text-[var(--text-primary)] border border-[var(--border)]">
                              {t('fullyPicked')}
                            </span>
                          ) : (
                            <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-[var(--bg-secondary)] text-[var(--text-secondary)] border border-[var(--border)]">
                              {t('partiallyPicked', { picked: String(order.pickedLinesCount), total: String(order.totalLines) })}
                            </span>
                          )}
                        </div>
                        {order.customerName && (
                          <p className="text-xs text-[var(--text-muted)] mt-1">
                            {order.customerName}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Ship Action */}
                    <div className="flex items-center gap-4">
                      <Button
                        variant="primary"
                        size="default"
                        onClick={() => handleDispatchOrder(order.orderId)}
                        disabled={isDispatching || !order.canShip}
                        className="shrink-0 px-5 py-2 text-sm"
                      >
                        {isDispatching ? (
                          <span className="flex items-center gap-2">
                            {/* eslint-disable-next-line i18next/no-literal-string -- Material UI Icon */}
                            <span className="material-symbols-outlined text-base animate-spin">refresh</span>
                            {t('dispatching')}
                          </span>
                        ) : order.isAllAvailablePicked ? (
                          t('shipOrder')
                        ) : (
                          t('shipPartial')
                        )}
                      </Button>
                    </div>
                  </div>

                  {/* Line Items List Toggle */}
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleOrderExpand(order.orderId)}
                        className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] px-0 py-1"
                      >
                        <span className="flex items-center gap-1">
                          {isExpanded ? (
                            <span className="material-symbols-outlined text-sm">expand_less</span>
                          ) : (
                            <span className="material-symbols-outlined text-sm">expand_more</span>
                          )}
                          {isExpanded ? t('hideDetails') : t('showDetails', { count: order.lines.length })}
                        </span>
                      </Button>
                    </div>

                    {isExpanded && (
                      <div className="pt-1">
                        <PickingOrderLinesView
                          lines={order.lines}
                          picks={order.picks}
                          readOnly={true}
                          onCancelPick={(pickId) => handleCancelPick(order.orderId, pickId)}
                        />
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { Button } from '@/components/shared/Button';
import InlineAlert from '@/components/shared/InlineAlert';
import * as api from '@herobm/sdk';
import { reportError } from '@/lib/api';
import { getErrorMessage, SHIPMENT_STATE } from '@herobm/shared';
import { toast } from 'react-hot-toast';
import Link from 'next/link';
import { routes } from '@/lib/routes';

interface ScannedLine {
  scanId: string;
  orderId: string;
  lineId: string;
  binId: string;
  quantity: string;
  productCode?: string;
  description?: string;
  binNumber?: string;
  scannedAt: Date;
  status: 'picked' | 'error';
  errorMessage?: string;
}

interface OrderSummary {
  orderId: string;
  orderNumber: string;
  customerName: string;
  totalLines: number;
  fullyPickedLines: number;
  scannedLines: ScannedLine[];
  isFullyPicked: boolean;
}

export default function ScanToDispatchClient() {
  const t = useTranslations('scanToDispatch');
  useDocumentTitle(t('title'));

  const [barcodeInput, setBarcodeInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [scannedHistory, setScannedHistory] = useState<ScannedLine[]>([]);
  const [ordersMap, setOrdersMap] = useState<Record<string, OrderSummary>>({});
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
    detail?: string;
  } | null>(null);
  const [isDispatching, setIsDispatching] = useState(false);

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
        osc.frequency.setValueAtTime(880, ctx.currentTime); // High pitch (A5)
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        osc.start();
        osc.stop(ctx.currentTime + 0.12);
      } else {
        osc.frequency.setValueAtTime(220, ctx.currentTime); // Low pitch warning
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        osc.start();
        osc.stop(ctx.currentTime + 0.28);
      }
    } catch {
      // Audio context might be restricted before first gesture
    }
  }, []);

  const refreshOrderSummary = useCallback(async (orderId: string, lineToAdd?: ScannedLine) => {
    try {
      const res = await api.orderPickingControllerGetPickingSummary(orderId);
      const summary = res.data;
      if (!summary) return;

      const orderInfo = await api.salesOrderFindOne(orderId).catch(() => null);
      const orderData = orderInfo?.data as { orderNumber?: string; customerName?: string } | undefined;

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
            totalLines: summary.totalLines,
            fullyPickedLines: summary.fullyPickedLines,
            scannedLines: newLines,
            isFullyPicked: summary.isFullyPicked,
          },
        };
      });

      if (!activeOrderId || activeOrderId === orderId) {
        setActiveOrderId(orderId);
      }
    } catch (err) {
      reportError(err, 'Failed to fetch order summary');
    }
  }, [activeOrderId]);

  const processBarcode = async (rawCode: string) => {
    const code = rawCode.trim();
    if (!code) return;

    setIsProcessing(true);
    setBarcodeInput('');

    try {
      // Format: PICK:{orderId}:{salesOrderLineId}:{binId}:{quantity}
      const parts = code.startsWith('PICK:') ? code.slice(5).split(':') : code.split(':');

      if (parts.length < 4) {
        throw new Error('Invalid barcode format. Expected: PICK:{orderId}:{lineId}:{binId}:{quantity}');
      }

      const [orderId, lineId, binId, qtyStr] = parts;
      const quantity = qtyStr || '1';

      // 1. Call the pickLine API
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

      setScannedHistory((prev) => [scannedItem, ...prev]);

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

    setIsDispatching(true);
    try {
      // Fetch shipping context to know shippable lines
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

      // Remove from map
      setOrdersMap((prev) => {
        const next = { ...prev };
        delete next[orderId];
        return next;
      });

      if (activeOrderId === orderId) {
        const remaining = Object.keys(ordersMap).filter((id) => id !== orderId);
        setActiveOrderId(remaining.length > 0 ? remaining[0] : null);
      }

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
      setIsDispatching(false);
      inputRef.current?.focus();
    }
  };

  const activeOrder = activeOrderId ? ordersMap[activeOrderId] : null;

  return (
    <div className="flex flex-col h-full w-full min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)]">
      {/* Header Bar */}
      <div className="px-6 py-4 border-b border-[var(--border)] bg-[var(--bg-secondary)] flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            {/* eslint-disable-next-line i18next/no-literal-string -- Material UI Icon */}
            <span className="material-symbols-outlined text-[var(--accent)] text-2xl">barcode_scanner</span>
            <h1 className="text-lg font-bold">{t('title')}</h1>
          </div>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">
            {t('subtitle')}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link href={routes.inventory.shipping()}>
            <Button variant="secondary" size="sm">
              {t('standardShipping')}
            </Button>
          </Link>
          <Link href={routes.inventory.picking()}>
            <Button variant="secondary" size="sm">
              {t('pickingQueue')}
            </Button>
          </Link>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 max-w-7xl mx-auto w-full">
        {/* Left Column: Scanner Bar & Active Order Action */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          {/* Scanner Input Card */}
          <div className="p-6 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] shadow-sm">
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
                  title={feedback.message}
                  message={feedback.detail}
                />
              </div>
            )}
          </div>

          {/* Active Order Card */}
          {activeOrder ? (
            <div className="p-6 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] shadow-sm flex flex-col gap-4">
              <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
                <div>
                  <span className="text-xs uppercase tracking-wider text-[var(--text-muted)] font-semibold">{t('activeOrder')}</span>
                  <h2 className="text-xl font-bold text-[var(--text-primary)]">{activeOrder.orderNumber}</h2>
                  {activeOrder.customerName && (
                    <p className="text-sm text-[var(--text-secondary)]">{activeOrder.customerName}</p>
                  )}
                </div>
                <div className="text-right">
                  <span className="text-xs text-[var(--text-muted)]">{t('progress')}</span>
                  <div className="text-lg font-bold text-[var(--accent)]">
                    {t('linesPicked', { picked: activeOrder.fullyPickedLines, total: activeOrder.totalLines })}
                  </div>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-[var(--bg-secondary)] h-3 rounded-full overflow-hidden">
                <div
                  className="bg-emerald-500 h-full transition-all duration-300 rounded-full"
                  style={{
                    width: `${Math.min(
                      100,
                      activeOrder.totalLines > 0
                        ? (activeOrder.fullyPickedLines / activeOrder.totalLines) * 100
                        : 0
                    )}%`,
                  }}
                />
              </div>

              {/* Dispatch Action */}
              <div className="pt-2 flex items-center justify-between gap-4">
                <p className="text-xs text-[var(--text-muted)]">
                  {activeOrder.isFullyPicked ? t('allLinesPicked') : t('partialOrderPrompt')}
                </p>
                <Button
                  variant="primary"
                  size="default"
                  onClick={() => handleDispatchOrder(activeOrder.orderId)}
                  disabled={isDispatching || activeOrder.fullyPickedLines === 0}
                  className="shrink-0 px-6 py-2.5 text-sm"
                >
                  {isDispatching ? (
                    <span className="flex items-center gap-2">
                      {/* eslint-disable-next-line i18next/no-literal-string -- Material UI Icon */}
                      <span className="material-symbols-outlined text-base animate-spin">refresh</span>
                      {t('dispatching')}
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      {/* eslint-disable-next-line i18next/no-literal-string -- Material UI Icon */}
                      <span className="material-symbols-outlined text-base">local_shipping</span>
                      {t('completeDispatch')}
                    </span>
                  )}
                </Button>
              </div>
            </div>
          ) : (
            <div className="p-8 rounded-xl border border-dashed border-[var(--border)] bg-[var(--bg-card)] text-center text-[var(--text-muted)]">
              {/* eslint-disable-next-line i18next/no-literal-string -- Material UI Icon */}
              <span className="material-symbols-outlined text-4xl mb-2 opacity-50">qr_code_scanner</span>
              <p className="text-sm">{t('emptyPrompt')}</p>
            </div>
          )}
        </div>

        {/* Right Column: Scanned Items Feed */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] shadow-sm flex flex-col h-full max-h-[600px]">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--border)] mb-3">
              <h3 className="text-sm font-bold flex items-center gap-2">
                {/* eslint-disable-next-line i18next/no-literal-string -- Material UI Icon */}
                <span className="material-symbols-outlined text-base text-[var(--text-muted)]">history</span>
                {t('scannedFeed')}
              </h3>
              <span className="text-xs text-[var(--text-muted)]">
                {t('totalScans', { count: scannedHistory.length })}
              </span>
            </div>

            <div className="flex-1 overflow-y-auto flex flex-col gap-2">
              {scannedHistory.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-[var(--text-muted)]">
                  <p className="text-xs">{t('emptyHistory')}</p>
                </div>
              ) : (
                scannedHistory.map((item) => (
                  <div
                    key={item.scanId}
                    className="p-3 rounded-lg border border-[var(--border)] bg-[var(--bg-secondary)] flex items-center justify-between text-xs transition-all hover:border-[var(--accent)]"
                  >
                    <div>
                      <div className="font-bold text-[var(--text-primary)]">
                        {t('pickedLine', { lineId: item.lineId.slice(0, 8) })}
                      </div>
                      <div className="text-[var(--text-muted)] text-[11px] mt-0.5">
                        Bin: {item.binId.slice(0, 8)} &middot; Qty: {item.quantity}
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="inline-flex items-center gap-1 text-emerald-600 font-semibold">
                        {/* eslint-disable-next-line i18next/no-literal-string -- Material UI Icon */}
                        <span className="material-symbols-outlined text-sm">check_circle</span>
                        {t('success')}
                      </span>
                      <div className="text-[10px] text-[var(--text-muted)] mt-0.5">
                        {item.scannedAt.toLocaleTimeString()}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* eslint-disable i18next/no-literal-string -- Material symbols icon names and UI glyphs */
'use client';

import { useState, useMemo, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { reportError } from '@/lib/api';
import * as api from '@herobm/sdk';
import toast from 'react-hot-toast';
import SlideOver from '@/components/shared/SlideOver';
import SupplierSelect, { Supplier } from '@/components/shared/SupplierSelect';
import { Button } from '@/components/shared/Button';
import Link from 'next/link';
import { routes } from '@/lib/routes';
import type { RestockItemDto } from '@/app/demand/restock/RestockContent';

export interface RestockItemWithQty extends RestockItemDto {
  restockQty: number;
}

interface RestockGeneratePOsSlideOverProps {
  isOpen: boolean;
  onClose: () => void;
  items: RestockItemWithQty[];
  onSuccess: () => void;
}

export default function RestockGeneratePOsSlideOver({
  isOpen,
  onClose,
  items,
  onSuccess,
}: RestockGeneratePOsSlideOverProps) {
  const t = useTranslations('demand.restock');
  const tCommon = useTranslations('common');
  const [loading, setLoading] = useState(false);

  // Excluded item IDs if user removes a line
  const [excludedIds, setExcludedIds] = useState<Set<string>>(new Set());

  // Line overrides: { [rowId]: { vendorId, vendorName, costPrice, currencyCode, quantity } }
  const [lineOverrides, setLineOverrides] = useState<
    Record<
      string,
      {
        vendorId: string | undefined;
        vendorName: string;
        costPrice: number | string;
        currencyCode: string;
        quantity: number | string;
      }
    >
  >({});

  useEffect(() => {
    if (isOpen) {
      setExcludedIds(new Set());
      const initial: typeof lineOverrides = {};
      items.forEach((item) => {
        initial[item.id] = {
          vendorId: item.vendorId || undefined,
          vendorName: item.vendorName || t('unassigned'),
          costPrice: item.costPrice || 0,
          currencyCode: item.currencyCode || 'USD',
          quantity: item.restockQty > 0 ? item.restockQty : item.suggestedRestockQty,
        };
      });
      setLineOverrides(initial);
    }
  }, [isOpen, items, t]);

  const activeItems = useMemo(() => {
    return items.filter((item) => !excludedIds.has(item.id));
  }, [items, excludedIds]);

  const groupedItems = useMemo(() => {
    const groups: Record<
      string,
      {
        vendorId: string | undefined;
        vendorName: string;
        locationId: string;
        locationName: string;
        locationCode: string;
        currencyCode: string;
        items: (RestockItemWithQty & { currentCost: number | string; currentQty: number | string })[];
        subtotal: number;
      }
    > = {};

    activeItems.forEach((item) => {
      const override = lineOverrides[item.id] || {
        vendorId: item.vendorId || undefined,
        vendorName: item.vendorName || t('unassigned'),
        costPrice: item.costPrice || 0,
        currencyCode: item.currencyCode || 'USD',
        quantity: item.restockQty > 0 ? item.restockQty : item.suggestedRestockQty,
      };
      const vId = override.vendorId || 'unassigned';
      const key = `${vId}_${item.locationId}`;

      if (!groups[key]) {
        groups[key] = {
          vendorId: override.vendorId,
          vendorName: override.vendorName,
          locationId: item.locationId,
          locationName: item.locationName,
          locationCode: item.locationCode,
          currencyCode: override.currencyCode,
          items: [],
          subtotal: 0,
        };
      }

      const costNum = typeof override.costPrice === 'number' ? override.costPrice : parseFloat(String(override.costPrice || '0')) || 0;
      const qtyNum = typeof override.quantity === 'number' ? override.quantity : parseFloat(String(override.quantity || '0')) || 0;
      const lineTotal = qtyNum * costNum;
      groups[key].items.push({ ...item, currentCost: override.costPrice, currentQty: override.quantity });
      groups[key].subtotal += lineTotal;
    });

    return Object.values(groups);
  }, [activeItems, lineOverrides, t]);

  const validPoGroups = groupedItems.filter((g) => Boolean(g.vendorId) && g.items.length > 0);
  const totalPoCount = validPoGroups.length;
  const totalLines = activeItems.length;
  const overallEstCost = groupedItems.reduce((acc, g) => acc + g.subtotal, 0);

  const handleGroupSupplierChange = (
    currentVendorId: string | undefined,
    locationId: string,
    supplier: Supplier | null
  ) => {
    setLineOverrides((prev) => {
      const next = { ...prev };
      activeItems.forEach((item) => {
        const override = next[item.id];
        if (
          item.locationId === locationId &&
          (override?.vendorId === currentVendorId || (!override?.vendorId && !currentVendorId))
        ) {
          next[item.id] = {
            vendorId: supplier?.vendorId,
            vendorName: supplier ? `${supplier.vendorNumber} - ${supplier.name}` : t('unassigned'),
            costPrice: override?.costPrice ?? 0,
            currencyCode: supplier?.currencyCode || override?.currencyCode || 'USD',
            quantity: override?.quantity ?? item.restockQty,
          };
        }
      });
      return next;
    });
  };

  const handleItemQtyChange = (rowId: string, val: string) => {
    setLineOverrides((prev) => ({
      ...prev,
      [rowId]: {
        ...prev[rowId],
        quantity: val,
      },
    }));
  };

  const handleItemCostChange = (rowId: string, val: string) => {
    setLineOverrides((prev) => ({
      ...prev,
      [rowId]: {
        ...prev[rowId],
        costPrice: val,
      },
    }));
  };

  const handleExcludeItem = (rowId: string) => {
    setExcludedIds((prev) => {
      const next = new Set(prev);
      next.add(rowId);
      return next;
    });
  };

  const handleGenerate = async () => {
    if (activeItems.length === 0) {
      toast.error(t('selectItemsToRestockError'));
      return;
    }

    const hasUnassigned = activeItems.some((item) => !lineOverrides[item.id]?.vendorId);
    if (hasUnassigned) {
      toast.error(t('allAssignedError'));
      return;
    }

    setLoading(true);
    try {
      const posPayload: api.GeneratePoDto[] = validPoGroups.map((group) => {
        const linesMap = new Map<
          string,
          { productId: string; quantity: number; pricePerUnit: number }
        >();

        group.items.forEach((item) => {
          const numQty = typeof item.currentQty === 'number' ? item.currentQty : parseFloat(String(item.currentQty || '0')) || 0;
          const numCost = typeof item.currentCost === 'number' ? item.currentCost : parseFloat(String(item.currentCost || '0')) || 0;
          if (numQty <= 0) return;

          if (!linesMap.has(item.productId)) {
            linesMap.set(item.productId, {
              productId: item.productId,
              quantity: 0,
              pricePerUnit: numCost,
            });
          }
          const l = linesMap.get(item.productId)!;
          l.quantity += numQty;
        });

        return {
          vendorId: group.vendorId!,
          deliveryLocationId: group.locationId,
          currencyCode: group.currencyCode || 'USD',
          soNumbers: ['Restock'],
          lines: Array.from(linesMap.values()).map((l) => ({
            productId: l.productId,
            quantity: l.quantity.toString(),
            pricePerUnit: l.pricePerUnit.toString(),
          })),
        };
      });

      await api.allocationsControllerGeneratePOs({
        pos: posPayload,
      });

      toast.success(t('posGeneratedSuccess', { count: posPayload.length }));
      onSuccess();
    } catch (err) {
      reportError(err, 'RestockGeneratePOsSlideOver');
      toast.error(t('posGeneratedError'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <SlideOver
      isOpen={isOpen}
      onClose={onClose}
      title={t('reviewDraftPosTitle')}
      width="max-w-5xl"
      footer={
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-4 text-xs">
            <span className="font-medium text-[var(--text-secondary)]">
              {totalPoCount} {t('totalPOsToCreate')}
            </span>
            <span className="text-[var(--text-muted)]">•</span>
            <span className="font-medium text-[var(--text-secondary)]">
              {t('linesCount', { count: totalLines })}
            </span>
            <span className="text-[var(--text-muted)]">•</span>
            <span className="font-bold text-sm text-[var(--text-primary)] font-mono">
              ${overallEstCost.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={onClose} disabled={loading}>
              {tCommon('buttons.cancel')}
            </Button>
            <Button
              variant="primary"
              loading={loading}
              onClick={handleGenerate}
              disabled={activeItems.length === 0 || loading}
            >
              {loading ? t('generatingPOs') : t('generatePOs')}
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-6">
        {activeItems.length === 0 ? (
          <div className="p-8 text-center text-[var(--text-muted)]">
            <span className="material-symbols-outlined text-4xl mb-2 text-[var(--text-muted)]">
              inventory
            </span>
            <p className="text-sm font-medium">{t('selectItemsToRestockError')}</p>
          </div>
        ) : (
          groupedItems.map((group, groupIdx) => {
            const isUnassigned = !group.vendorId;
            const cardBorderClass = isUnassigned
              ? 'border-amber-500/40 bg-amber-500/5 dark:bg-amber-950/10'
              : 'border-[var(--border)] bg-[var(--bg-card)]';

            return (
              <div
                key={`${group.vendorId || 'unassigned'}_${group.locationId}_${groupIdx}`}
                className={`rounded-xl border transition-all ${cardBorderClass}`}
              >
                {/* PO Group Header */}
                <div className="p-4 border-b border-[var(--border)] flex flex-wrap items-center justify-between gap-4 bg-[var(--surface-card)] rounded-t-xl">
                  <div className="flex-1 min-w-[240px]">
                    {isUnassigned ? (
                      <div>
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <span className="material-symbols-outlined text-[18px] text-amber-500">
                            warning
                          </span>
                          <span className="text-xs font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider">
                            {t('unassignedActionRequired')}
                          </span>
                        </div>
                        <div className="w-64">
                          <SupplierSelect
                            value={null}
                            onChange={(sup) =>
                              handleGroupSupplierChange(
                                group.vendorId,
                                group.locationId,
                                sup
                              )
                            }
                            placeholder={t('selectSupplier')}
                          />
                        </div>
                      </div>
                    ) : (
                      <Link
                        href={routes.suppliers.detail(group.vendorId!)}
                        className="font-bold text-base text-[#006b5c] dark:text-emerald-400 hover:underline"
                      >
                        {group.vendorName}
                      </Link>
                    )}
                  </div>

                  <div className="flex items-start gap-6 text-right">
                    <div className="flex flex-col items-end">
                      <span className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                        {t('deliverTo')}
                      </span>
                      <span className="text-xs font-semibold text-[var(--text-primary)] mt-1">
                        {group.locationCode} ({group.locationName})
                      </span>
                    </div>

                    <div className="flex flex-col items-end">
                      <span className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                        {t('estSubtotal')}
                      </span>
                      <span className="text-sm font-bold font-mono text-[var(--text-primary)] mt-0.5">
                        ${group.subtotal.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Items Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-[var(--border)] text-[var(--text-muted)] bg-[var(--bg-secondary)]/50">
                        <th className="py-2.5 px-4 text-left font-semibold">
                          {t('colProduct')}
                        </th>
                        <th className="py-2.5 px-3 text-left font-semibold">
                          {t('colBin')}
                        </th>
                        <th className="py-2.5 px-3 text-right font-semibold">
                          {t('colOnHand')}
                        </th>
                        <th className="py-2.5 px-3 text-right font-semibold">
                          {t('colOnOrder')}
                        </th>
                        <th className="py-2.5 px-3 text-right font-semibold">
                          {t('colMinQty')}
                        </th>
                        <th className="py-2.5 px-3 text-right font-semibold">
                          {t('colMaxQty')}
                        </th>
                        <th className="py-2.5 px-3 text-right font-semibold">
                          {t('colRestockQty')}
                        </th>
                        <th className="py-2.5 px-3 text-right font-semibold">
                          {t('colUnitCost')}
                        </th>
                        <th className="py-2.5 px-4 text-right font-semibold">
                          {t('colLineTotal')}
                        </th>
                        <th className="py-2.5 px-2 text-center w-8"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border)]">
                      {group.items.map((item) => {
                        const numQty =
                          typeof item.currentQty === 'number'
                            ? item.currentQty
                            : parseFloat(String(item.currentQty || '0')) || 0;
                        const numCost =
                          typeof item.currentCost === 'number'
                            ? item.currentCost
                            : parseFloat(String(item.currentCost || '0')) || 0;
                        const lineTotal = numQty * numCost;
                        const numUnit =
                          item.purchaseUnit !== undefined &&
                          item.purchaseUnit !== null &&
                          item.purchaseUnit !== '' &&
                          !isNaN(Number(item.purchaseUnit))
                            ? parseFloat(String(item.purchaseUnit))
                            : undefined;
                        const hasMoq = Boolean(
                          item.minPurchaseQty && item.minPurchaseQty > 1,
                        );
                        const isBelowMoq = Boolean(
                          hasMoq &&
                            (numQty <= 0 || numQty < (item.minPurchaseQty || 0)),
                        );
                        const isNotMultiple = Boolean(
                          numUnit &&
                            numUnit > 1 &&
                            (numQty <= 0 || numQty % numUnit !== 0),
                        );
                        const hasQtyWarning = isBelowMoq || isNotMultiple;

                        return (
                          <tr
                            key={item.id}
                            className="align-top hover:bg-[var(--bg-secondary)]/40 transition-colors"
                          >
                            <td className="py-2.5 px-4 align-top">
                              <div className="font-semibold text-[var(--text-primary)]">
                                {item.productNumber}
                              </div>
                              <div className="text-[11px] text-[var(--text-muted)] line-clamp-1">
                                {item.productName}
                              </div>
                            </td>
                            <td className="py-2.5 px-3 align-top">
                              <div className="font-mono text-xs text-[var(--text-secondary)] font-medium">
                                {item.zoneCode
                                  ? `${item.zoneCode} - ${item.binNumber}`
                                  : item.binNumber}
                              </div>
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono text-[var(--text-primary)] align-top pt-3">
                              {Number(
                                item.quantityOnHand ?? 0,
                              ).toLocaleString()}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono text-[var(--text-muted)] align-top pt-3">
                              {Number(
                                item.quantityOnOrder ?? 0,
                              ).toLocaleString()}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono text-[var(--text-secondary)] align-top pt-3">
                              {Number(item.minQuantity ?? 0).toLocaleString()}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono text-[var(--text-secondary)] align-top pt-3">
                              {item.maxQuantity !== null &&
                              item.maxQuantity !== undefined
                                ? Number(item.maxQuantity).toLocaleString()
                                : '—'}
                            </td>
                            <td className="py-2.5 px-3 text-right align-top">
                              <div className="flex flex-col items-end gap-1">
                                <input
                                  type="number"
                                  min="0"
                                  step="1"
                                  value={item.currentQty ?? ''}
                                  onChange={(e) =>
                                    handleItemQtyChange(item.id, e.target.value)
                                  }
                                  className={`w-20 h-8 px-2 py-1 text-xs font-mono font-bold bg-[var(--surface-card)] border rounded text-right text-[var(--text-primary)] focus:outline-none ${
                                    hasQtyWarning
                                      ? 'border-amber-500 focus:border-amber-500'
                                      : 'border-[var(--border)] focus:border-[var(--accent)]'
                                  }`}
                                />
                                {hasMoq || item.purchaseUnit ? (
                                  <div className="flex items-center gap-1 text-[10px] font-mono leading-none whitespace-nowrap">
                                    {hasMoq && (
                                      <span
                                        className={
                                          isBelowMoq
                                            ? 'text-amber-600 dark:text-amber-400 font-bold'
                                            : 'text-[var(--text-muted)]'
                                        }
                                      >
                                        MOQ: {item.minPurchaseQty}
                                      </span>
                                    )}
                                    {hasMoq && item.purchaseUnit && (
                                      <span className="text-[var(--text-muted)]">
                                        •
                                      </span>
                                    )}
                                    {item.purchaseUnit && (
                                      <span
                                        className={
                                          isNotMultiple
                                            ? 'text-amber-600 dark:text-amber-400 font-bold'
                                            : 'text-[var(--text-muted)]'
                                        }
                                      >
                                        Unit: {item.purchaseUnit}
                                      </span>
                                    )}
                                  </div>
                                ) : null}
                              </div>
                            </td>
                            <td className="py-2.5 px-3 text-right align-top">
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={item.currentCost ?? ''}
                                onChange={(e) =>
                                  handleItemCostChange(item.id, e.target.value)
                                }
                                className="w-20 h-8 px-2 py-1 text-xs font-mono bg-[var(--surface-card)] border border-[var(--border)] rounded text-right text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
                              />
                            </td>
                            <td className="py-2.5 px-4 text-right font-mono font-bold text-[var(--text-primary)] align-top pt-3">
                              ${lineTotal.toFixed(2)}
                            </td>
                            <td className="py-2.5 px-2 text-center align-top pt-2">
                              <Button
                                variant="ghost"
                                size="xs"
                                onClick={() => handleExcludeItem(item.id)}
                                className="text-red-500 hover:bg-red-500/10 p-1"
                                title={tCommon('buttons.delete')}
                              >
                                <span className="material-symbols-outlined text-[18px]">
                                  delete
                                </span>
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })
        )}
      </div>
    </SlideOver>
  );
}

'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'react-hot-toast';
import * as api from '@herobm/sdk';
import { getErrorMessage } from '@herobm/shared';
import SlideOver from '@/components/shared/SlideOver';
import { Button } from '@/components/shared/Button';
import { formatAmount } from '@/lib/currency';
import {
  applyPercentChange,
  computeBaseUnitCost,
  computeCostDeltaPercent,
  computeMarginPercent,
  formatPriceString,
  PriceRoundingStrategy,
  recalculateMaintainingMargin,
  roundPrice,
} from '@/lib/price-adjustment';

interface ProductUomOption {
  productUomId?: string;
  uomCode: string;
  ratio: number;
  isPurchaseDefault?: boolean | null;
}

interface LoadedProductPricing {
  productId: string;
  productNumber: string;
  name: string;
  baseUom: string;
  defaultPurchaseUomId?: string | null;
  standardCost?: string | null;
  weightedAverageCost?: string | null;
  listPrice?: string | null;
  tradePrice?: string | null;
  priceLevel3?: string | null;
  priceLevel4?: string | null;
  productUoms?: {
    productUomId?: string;
    uomCode: string;
    ratio: string | number;
    isPurchaseDefault?: boolean | null;
  }[];
}

export interface AdjustedProductPrices {
  productId: string;
  standardCost?: string;
  listPrice?: string;
  tradePrice?: string;
  priceLevel3?: string;
  priceLevel4?: string;
}

export interface AdjustProductPricesSlideOverProps {
  isOpen: boolean;
  onClose: () => void;
  productId: string | null;
  invoiceUnitCost: number;
  currencyCode?: string;
  onSaved?: (updated: AdjustedProductPrices) => void;
}

type SellPriceField = 'listPrice' | 'tradePrice' | 'priceLevel3' | 'priceLevel4';

const SELL_PRICE_FIELDS: SellPriceField[] = [
  'listPrice',
  'tradePrice',
  'priceLevel3',
  'priceLevel4',
];

function toInputValue(val: string | number | null | undefined): string {
  if (val === null || val === undefined || val === '') return '';
  const num = typeof val === 'string' ? parseFloat(val) : val;
  if (!Number.isFinite(num)) return '';
  return num.toFixed(2);
}

export default function AdjustProductPricesSlideOver({
  isOpen,
  onClose,
  productId,
  invoiceUnitCost,
  currencyCode = 'EUR',
  onSaved,
}: AdjustProductPricesSlideOverProps) {
  const t = useTranslations('products.priceAdjustment');
  const tCommon = useTranslations('common');

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [product, setProduct] = useState<LoadedProductPricing | null>(null);

  const [selectedUomKey, setSelectedUomKey] = useState<string>('BASE');

  const [standardCost, setStandardCost] = useState('');
  const [sellPrices, setSellPrices] = useState<Record<SellPriceField, string>>({
    listPrice: '',
    tradePrice: '',
    priceLevel3: '',
    priceLevel4: '',
  });

  useEffect(() => {
    if (!isOpen || !productId) return;
    let mounted = true;
    setLoading(true);
    setError(null);

    api
      .productsControllerFindOne(productId)
      .then((res) => {
        if (!mounted) return;
        const data = (res.data ?? res) as unknown as LoadedProductPricing;
        setProduct(data);
        setStandardCost(toInputValue(data.standardCost));
        setSellPrices({
          listPrice: toInputValue(data.listPrice),
          tradePrice: toInputValue(data.tradePrice),
          priceLevel3: toInputValue(data.priceLevel3),
          priceLevel4: toInputValue(data.priceLevel4),
        });

        // Auto-select purchase default UOM if configured with ratio !== 1
        const uoms = data.productUoms || [];
        const defaultPurchaseUom =
          uoms.find(
            (u) =>
              (data.defaultPurchaseUomId &&
                u.productUomId === data.defaultPurchaseUomId) ||
              u.isPurchaseDefault,
          ) || null;
        if (
          defaultPurchaseUom &&
          Number(defaultPurchaseUom.ratio) > 0 &&
          Number(defaultPurchaseUom.ratio) !== 1
        ) {
          setSelectedUomKey(
            defaultPurchaseUom.productUomId || defaultPurchaseUom.uomCode,
          );
        } else {
          setSelectedUomKey('BASE');
        }
      })
      .catch((err) => {
        if (!mounted) return;
        setError(getErrorMessage(err) || t('loadError'));
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [isOpen, productId]);

  const uomOptions = useMemo<ProductUomOption[]>(() => {
    if (!product) return [];
    const baseCode = product.baseUom || 'EA';
    const options: ProductUomOption[] = [
      {
        productUomId: 'BASE',
        uomCode: baseCode,
        ratio: 1,
      },
    ];
    for (const u of product.productUoms || []) {
      const ratioNum = Number(u.ratio);
      if (!Number.isFinite(ratioNum) || ratioNum <= 0) continue;
      if (u.uomCode === baseCode && ratioNum === 1) continue;
      options.push({
        productUomId: u.productUomId || u.uomCode,
        uomCode: u.uomCode,
        ratio: ratioNum,
        isPurchaseDefault: u.isPurchaseDefault,
      });
    }
    return options;
  }, [product]);

  const activeUom = useMemo(() => {
    return (
      uomOptions.find((o) => (o.productUomId || o.uomCode) === selectedUomKey) ||
      uomOptions[0] || { uomCode: product?.baseUom || 'EA', ratio: 1 }
    );
  }, [uomOptions, selectedUomKey, product?.baseUom]);

  const effectiveBaseCost = useMemo(
    () => computeBaseUnitCost(invoiceUnitCost, activeUom.ratio),
    [invoiceUnitCost, activeUom.ratio],
  );

  const previousCostNum = useMemo(() => {
    if (!product?.standardCost) return null;
    const n = parseFloat(product.standardCost);
    return Number.isFinite(n) && n > 0 ? n : null;
  }, [product?.standardCost]);

  const costDeltaPct = useMemo(
    () => computeCostDeltaPercent(previousCostNum, effectiveBaseCost),
    [previousCostNum, effectiveBaseCost],
  );

  const applyMaintainMargin = () => {
    if (!product || !previousCostNum || effectiveBaseCost <= 0) return;
    setSellPrices((prev) => {
      const next = { ...prev };
      for (const field of SELL_PRICE_FIELDS) {
        const oldVal = parseFloat(product[field] || '');
        if (!Number.isFinite(oldVal) || oldVal <= 0) continue;
        const recalculated = recalculateMaintainingMargin(
          oldVal,
          previousCostNum,
          effectiveBaseCost,
        );
        if (recalculated !== null) {
          next[field] = formatPriceString(recalculated);
        }
      }
      return next;
    });
  };

  const applyCostIncreasePercent = () => {
    if (!product || costDeltaPct === null) return;
    setSellPrices((prev) => {
      const next = { ...prev };
      for (const field of SELL_PRICE_FIELDS) {
        const oldVal = parseFloat(product[field] || '');
        if (!Number.isFinite(oldVal) || oldVal <= 0) continue;
        const adjusted = applyPercentChange(oldVal, costDeltaPct);
        next[field] = formatPriceString(adjusted);
      }
      return next;
    });
  };

  const applyRounding = (strategy: Exclude<PriceRoundingStrategy, 'none'>) => {
    setSellPrices((prev) => {
      const next = { ...prev };
      for (const field of SELL_PRICE_FIELDS) {
        const currVal = parseFloat(prev[field] || '');
        if (!Number.isFinite(currVal) || currVal <= 0) continue;
        next[field] = formatPriceString(roundPrice(currVal, strategy));
      }
      return next;
    });
  };

  const handleUseInvoiceCost = () => {
    setStandardCost(formatPriceString(effectiveBaseCost));
  };

  const handleSave = async () => {
    if (!product || !productId) return;
    const payload: Record<string, string> = {};

    const origStandardCost = toInputValue(product.standardCost);
    const trimmedStd = standardCost.trim();
    if (trimmedStd !== '' && trimmedStd !== origStandardCost) {
      const num = parseFloat(trimmedStd);
      if (Number.isFinite(num) && num >= 0) {
        payload.standardCost = formatPriceString(num);
      }
    }

    for (const field of SELL_PRICE_FIELDS) {
      const origVal = toInputValue(product[field]);
      const currVal = sellPrices[field].trim();
      if (currVal !== '' && currVal !== origVal) {
        const num = parseFloat(currVal);
        if (Number.isFinite(num) && num >= 0) {
          payload[field] = formatPriceString(num);
        }
      }
    }

    if (Object.keys(payload).length === 0) {
      toast(t('noChanges'));
      onClose();
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await api.productsControllerUpdate(
        productId,
        payload as unknown as api.UpdateProductDto,
      );
      toast.success(t('saveSuccess'));
      onSaved?.({
        productId,
        ...payload,
      });
      onClose();
    } catch (err) {
      const msg = getErrorMessage(err) || t('saveError');
      setError(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const baseUomLabel = product?.baseUom || 'EA';
  const showUomSelector = uomOptions.length > 1;

  const fieldLabels: Record<SellPriceField, string> = {
    listPrice: t('listPrice'),
    tradePrice: t('tradePrice'),
    priceLevel3: t('priceLevel3'),
    priceLevel4: t('priceLevel4'),
  };

  return (
    <SlideOver
      isOpen={isOpen}
      onClose={onClose}
      title={t('title')}
      subtitle={
        product
          ? `${product.productNumber} — ${product.name}`
          : t('subtitle')
      }
      width="max-w-lg"
      footer={
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={onClose}
            disabled={saving}
          >
            {tCommon('cancel')}
          </Button>
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={() => void handleSave()}
            disabled={loading || saving || !product}
          >
            {saving ? tCommon('saving') : t('saveButton')}
          </Button>
        </div>
      }
    >
      {loading ? (
        <div className="py-12 text-center text-sm text-[var(--text-muted)]">
          {tCommon('loading')}
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          {error && (
            <div className="px-3.5 py-2.5 rounded-lg text-xs bg-red-500/10 border border-red-500/30 text-red-500">
              {error}
            </div>
          )}

          {product && (
            <>
              {/* Cost Comparison Card */}
              <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)]/60 p-4 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                    {t('costComparison')}
                  </span>
                  {costDeltaPct !== null && Math.abs(costDeltaPct) >= 0.01 && (
                    <span
                      className={`text-xs font-bold px-2 py-0.5 rounded-full tabular-nums ${
                        costDeltaPct > 0
                          ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                          : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                      }`}
                    >
                      {costDeltaPct > 0 ? '+' : ''}
                      {costDeltaPct.toFixed(1)}%
                    </span>
                  )}
                </div>

                {showUomSelector && (
                  <div className="flex items-center justify-between gap-3 pt-1">
                    <label
                      htmlFor="adjust-price-uom-select"
                      className="text-xs font-medium text-[var(--text-secondary)]"
                    >
                      {t('billedUom')}
                    </label>
                    <select
                      id="adjust-price-uom-select"
                      className="input !w-auto !h-8 !py-0.5 !px-2.5 text-xs"
                      value={selectedUomKey}
                      onChange={(e) => setSelectedUomKey(e.target.value)}
                    >
                      {uomOptions.map((opt) => (
                        <option
                          key={opt.productUomId || opt.uomCode}
                          value={opt.productUomId || opt.uomCode}
                        >
                          {opt.uomCode} (×{opt.ratio})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg bg-[var(--bg-card)] border border-[var(--border)] px-3 py-2">
                    <div className="text-[11px] text-[var(--text-muted)]">
                      {t('previousCost')}
                    </div>
                    <div className="text-sm font-semibold tabular-nums mt-0.5">
                      {previousCostNum !== null
                        ? formatAmount(previousCostNum, currencyCode)
                        : '—'}
                    </div>
                  </div>
                  <div className="rounded-lg bg-[var(--bg-card)] border border-[var(--accent)]/40 px-3 py-2">
                    <div className="text-[11px] text-[var(--text-muted)]">
                      {t('baseUnitCost', { uom: baseUomLabel })}
                    </div>
                    <div className="text-sm font-bold text-[var(--accent)] tabular-nums mt-0.5">
                      {formatAmount(effectiveBaseCost, currencyCode)}
                    </div>
                  </div>
                </div>

                {activeUom.ratio !== 1 && (
                  <div className="text-[11px] text-[var(--text-muted)] tabular-nums">
                    {t('uomConversionHint', {
                      invoicePrice: formatAmount(invoiceUnitCost, currencyCode),
                      ratio: activeUom.ratio,
                      basePrice: formatAmount(effectiveBaseCost, currencyCode),
                      uom: baseUomLabel,
                    })}
                  </div>
                )}

                {product.weightedAverageCost && (
                  <div className="text-[11px] text-[var(--text-muted)] tabular-nums">
                    {t('weightedAvgCost', {
                      cost: formatAmount(
                        parseFloat(product.weightedAverageCost),
                        currencyCode,
                      ),
                    })}
                  </div>
                )}
              </div>

              {/* Standard Cost Field */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="adjust-standard-cost"
                    className="text-xs font-semibold text-[var(--text-secondary)]"
                  >
                    {t('standardCost')}
                  </label>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="!h-6 !px-2 !py-0 !text-[11px]"
                    onClick={handleUseInvoiceCost}
                    disabled={effectiveBaseCost <= 0}
                  >
                    {t('useInvoiceCost')}
                  </Button>
                </div>
                <input
                  id="adjust-standard-cost"
                  type="number"
                  min="0"
                  step="0.01"
                  className="input w-full text-right tabular-nums"
                  value={standardCost}
                  onChange={(e) => setStandardCost(e.target.value)}
                  onBlur={(e) => {
                    const val = parseFloat(e.target.value);
                    if (Number.isFinite(val)) {
                      setStandardCost(formatPriceString(val));
                    }
                  }}
                />
              </div>

              {/* Sell Prices (All 4 Levels) */}
              <div className="flex flex-col gap-3">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                  {t('sellPrices')}
                </h4>

                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={applyMaintainMargin}
                    disabled={!previousCostNum || effectiveBaseCost <= 0}
                  >
                    {t('maintainMargin')}
                  </Button>
                  {costDeltaPct !== null && Math.abs(costDeltaPct) >= 0.01 && (
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={applyCostIncreasePercent}
                    >
                      {t('applyCostIncrease', {
                        delta: `${costDeltaPct > 0 ? '+' : ''}${costDeltaPct.toFixed(1)}`,
                      })}
                    </Button>
                  )}
                </div>

                {SELL_PRICE_FIELDS.map((field) => {
                  const origPriceNum = parseFloat(product[field] || '');
                  const currPriceNum = parseFloat(sellPrices[field] || '');
                  const hasOrig = Number.isFinite(origPriceNum) && origPriceNum > 0;
                  const hasCurr = Number.isFinite(currPriceNum) && currPriceNum > 0;

                  const oldMargin =
                    hasOrig && previousCostNum !== null
                      ? computeMarginPercent(origPriceNum, previousCostNum)
                      : null;
                  const newMargin =
                    hasCurr && effectiveBaseCost > 0
                      ? computeMarginPercent(currPriceNum, effectiveBaseCost)
                      : null;
                  const isBelowCost =
                    hasCurr &&
                    effectiveBaseCost > 0 &&
                    currPriceNum < effectiveBaseCost;

                  return (
                    <div key={field} className="flex flex-col gap-1">
                      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5">
                        <label
                          htmlFor={`adjust-${field}`}
                          className="text-xs font-semibold text-[var(--text-secondary)]"
                        >
                          {fieldLabels[field]}
                        </label>
                        <div className="flex flex-wrap items-center gap-2 text-[11px] tabular-nums">
                          {hasOrig && (
                            <span className="text-[var(--text-muted)]">
                              {t('current', {
                                price: formatAmount(origPriceNum, currencyCode),
                              })}
                            </span>
                          )}
                          {newMargin !== null && (
                            <span
                              className={
                                isBelowCost
                                  ? 'text-red-500 font-semibold'
                                  : 'text-[var(--text-muted)]'
                              }
                            >
                              {oldMargin !== null
                                ? t('marginChange', {
                                    old: oldMargin.toFixed(1),
                                    new: newMargin.toFixed(1),
                                  })
                                : t('marginOnly', {
                                    margin: newMargin.toFixed(1),
                                  })}
                            </span>
                          )}
                          {isBelowCost && (
                            <span className="font-semibold text-red-500">
                              {t('belowCostWarning')}
                            </span>
                          )}
                        </div>
                      </div>

                      <input
                        id={`adjust-${field}`}
                        type="number"
                        min="0"
                        step="0.01"
                        className={`input w-full text-right tabular-nums ${
                          isBelowCost ? 'border-red-500/60' : ''
                        }`}
                        value={sellPrices[field]}
                        onChange={(e) =>
                          setSellPrices((prev) => ({
                            ...prev,
                            [field]: e.target.value,
                          }))
                        }
                        onBlur={(e) => {
                          const val = parseFloat(e.target.value);
                          if (Number.isFinite(val)) {
                            setSellPrices((prev) => ({
                              ...prev,
                              [field]: formatPriceString(val),
                            }));
                          }
                        }}
                      />
                    </div>
                  );
                })}

                <div className="flex flex-col gap-1.5 pt-1">
                  <span className="text-[11px] font-medium text-[var(--text-muted)]">
                    {t('rounding.label')}
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => applyRounding('nearest_0_05')}
                    >
                      {t('rounding.nearest005')}
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => applyRounding('end_95')}
                    >
                      {t('rounding.end95')}
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => applyRounding('end_99')}
                    >
                      {t('rounding.end99')}
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => applyRounding('nearest_1')}
                    >
                      {t('rounding.nearest1')}
                    </Button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </SlideOver>
  );
}

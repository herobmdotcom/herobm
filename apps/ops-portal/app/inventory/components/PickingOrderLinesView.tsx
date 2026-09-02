'use client';

import React, { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/shared/Button';
import { SALES_ORDER_PICK_STATE } from '@herobm/shared';

export interface PickingLine {
  salesOrderLineId: string;
  lineNumber: number;
  productId?: string;
  productNumber?: string;
  productType?: string;
  productDescription?: string;
  locationName?: string;
  availableBins?: { binId: string; binName: string; onHand: string }[];
  quantity: string;
  quantityPicked?: string;
  quantityShipped?: string;
  remaining?: string;
  isFullyPicked?: boolean;
  isPhysical?: boolean;
  isStocked?: boolean;
  onHand?: string;
  hasAllocation?: boolean;
}

export interface PickAllocation {
  pickId: string;
  salesOrderId: string;
  salesOrderLineId: string;
  productId: string;
  binId: string;
  quantity: string;
  stateCode: string;
  binName?: string;
  line?: PickingLine;
}

export interface PickingOrderLinesViewProps {
  lines: PickingLine[];
  picks?: PickAllocation[];
  readOnly?: boolean;
  pickInputs?: Record<string, { quantity: string; binId: string }>;
  onPickInputChange?: (lineId: string, input: { quantity?: string; binId?: string }) => void;
  onPickLine?: (lineId: string) => void;
  onCancelPick?: (pickId: string) => void;
  isSubmitting?: boolean;
}

export default function PickingOrderLinesView({
  lines,
  picks = [],
  readOnly = false,
  pickInputs = {},
  onPickInputChange,
  onPickLine,
  onCancelPick,
  isSubmitting = false,
}: PickingOrderLinesViewProps) {
  const t = useTranslations('picking');
  const tCommon = useTranslations('common');

  const { itemsToPick, unavailableItems, pickedItems, shippedItems, nonPhysicalItems } = useMemo(() => {
    const physicalLines = lines.filter((l) => (l.isPhysical ?? l.isStocked ?? true));
    const nonPhysical = lines.filter((l) => parseFloat(l.quantity) > 0 && !(l.isPhysical ?? l.isStocked ?? true));

    const toPick = physicalLines.filter((l) => {
      const remaining = parseFloat(String(l.remaining ?? (parseFloat(l.quantity) - parseFloat(l.quantityPicked || '0'))));
      const onHand = parseFloat(String(l.onHand || 0));
      return !l.isFullyPicked && remaining > 0 && onHand > 0;
    });

    const unavailable = physicalLines.filter((l) => {
      const remaining = parseFloat(String(l.remaining ?? (parseFloat(l.quantity) - parseFloat(l.quantityPicked || '0'))));
      const onHand = parseFloat(String(l.onHand || 0));
      const pickedQty = parseFloat(String(l.quantityPicked || '0'));
      return !l.isFullyPicked && remaining > 0 && onHand <= 0 && pickedQty === 0;
    });

    // Picked items from picks list or constructed from picked lines if no picks array
    let picked = picks
      .filter((p) => p.stateCode === SALES_ORDER_PICK_STATE.PICKED)
      .map((p) => {
        const line = lines.find((l) => l.salesOrderLineId === p.salesOrderLineId);
        return { ...p, line };
      });

    if (picked.length === 0) {
      picked = physicalLines
        .filter((l) => parseFloat(String(l.quantityPicked || '0')) > 0)
        .map((l) => ({
          pickId: `pick-${l.salesOrderLineId}`,
          salesOrderId: '',
          salesOrderLineId: l.salesOrderLineId,
          productId: l.productId || '',
          binId: l.availableBins?.[0]?.binId || '',
          binName: l.availableBins?.[0]?.binName || '',
          quantity: String(l.quantityPicked || '0'),
          stateCode: SALES_ORDER_PICK_STATE.PICKED,
          line: l,
        }));
    }

    const shipped = picks
      .filter((p) => p.stateCode === SALES_ORDER_PICK_STATE.SHIPPED)
      .map((p) => {
        const line = lines.find((l) => l.salesOrderLineId === p.salesOrderLineId);
        return { ...p, line };
      });

    return {
      itemsToPick: toPick,
      unavailableItems: unavailable,
      pickedItems: picked,
      shippedItems: shipped,
      nonPhysicalItems: nonPhysical,
    };
  }, [lines, picks]);

  return (
    <div className="space-y-8">
      {/* 1. Picked Table */}
      {pickedItems.length > 0 && (
        <div>
          <h4 className="section-heading !mb-4">{t('picked')}</h4>
          <table className="table-lines hidden lg:table">
            <thead>
              <tr>
                <th>{t('columns.product')}</th>
                <th>{t('columns.binLocation')}</th>
                <th className="text-right">{t('columns.ordered')}</th>
                <th className="text-right">{t('columns.remaining')}</th>
                <th className="text-right">{t('columns.onHand')}</th>
                <th className="text-right">{t('columns.pickQty')}</th>
                {Boolean(onCancelPick) && <th>{t('columns.action')}</th>}
              </tr>
            </thead>
            <tbody>
              {pickedItems.map((pick) => {
                const line = pick.line;
                const remaining = line?.remaining ?? (line ? String(parseFloat(line.quantity) - parseFloat(line.quantityPicked || '0')) : '-');
                return (
                  <tr key={pick.pickId}>
                    <td>
                      <div className="font-bold">{line?.productNumber || pick.productId?.slice(0, 8) || tCommon('unknown')}</div>
                      {line?.productDescription && (
                        <div className="text-xs text-[var(--text-muted)] truncate max-w-[200px]">
                          {line.productDescription}
                        </div>
                      )}
                    </td>
                    <td className="text-[var(--text-muted)]">{pick.binName || '-'}</td>
                    <td className="text-right text-[var(--text-muted)]">
                      <div>{line ? parseFloat(line.quantity).toLocaleString() : '-'}</div>
                    </td>
                    <td className="text-right text-[var(--text-muted)]">
                      <div>{line ? parseFloat(remaining).toLocaleString() : '-'}</div>
                    </td>
                    <td className="text-right text-[var(--text-muted)]">
                      <div>{line ? parseFloat(line.onHand || '0').toLocaleString() : '-'}</div>
                    </td>
                    <td className="text-right">
                      <div className="flex justify-end items-center gap-1.5 font-semibold text-[var(--text-primary)]">
                        {parseFloat(pick.quantity).toLocaleString()}
                      </div>
                    </td>
                    {onCancelPick && (
                      <td>
                        <div className="flex justify-end">
                          <Button
                            type="button"
                            onClick={() => onCancelPick(pick.pickId)}
                            disabled={isSubmitting}
                            variant="danger"
                            size="sm"
                            title={t('tooltips.cancelPick')}
                          >
                            <span dangerouslySetInnerHTML={{ __html: '&#10005;' }} />
                          </Button>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div className="flex flex-col gap-3 lg:hidden">
            {pickedItems.map((pick) => {
              const line = pick.line;
              return (
                <div
                  key={`mobile-picked-${pick.pickId}`}
                  className="bg-[var(--bg-primary)] p-3 rounded-lg border border-[var(--border)]"
                >
                  <div className="flex justify-between items-start mb-2">
                    <div className="min-w-0 flex-1 pr-2">
                      <div className="font-bold text-sm text-[var(--text-primary)] truncate">
                        {line?.productNumber || tCommon('unknown')}
                      </div>
                      {line?.productDescription && (
                        <div className="text-xs text-[var(--text-muted)] truncate">{line.productDescription}</div>
                      )}
                    </div>
                    {onCancelPick && (
                      <div className="flex flex-col items-end shrink-0">
                        <Button
                          type="button"
                          onClick={() => onCancelPick(pick.pickId)}
                          disabled={isSubmitting}
                          variant="danger"
                          size="sm"
                          title={t('tooltips.cancelPick')}
                        >
                          <span dangerouslySetInnerHTML={{ __html: '&#10005;' }} />
                        </Button>
                      </div>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2 bg-[var(--bg-card)] p-2 rounded border border-[var(--border)]">
                    <div>
                      <div className="text-[10px] text-[var(--text-muted)] uppercase mb-0.5">{t('columns.binLocation')}</div>
                      <div className="text-xs font-medium">{pick.binName || '-'}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-[var(--text-muted)] uppercase mb-0.5">{t('columns.pickQty')}</div>
                      <div className="text-xs font-medium flex items-center gap-1">
                        {parseFloat(pick.quantity).toLocaleString()}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 2. To Pick Table */}
      {itemsToPick.length > 0 && (
        <div>
          <h4 className="section-heading !mb-4">{t('toPick')}</h4>
          <table className="table-lines hidden lg:table">
            <thead>
              <tr>
                <th>{t('columns.product')}</th>
                <th>{t('columns.binLocation')}</th>
                <th className="text-right">{t('columns.ordered')}</th>
                <th className="text-right">{t('columns.remaining')}</th>
                <th className="text-right">{t('columns.onHand')}</th>
                <th className="text-right">{t('columns.pickQty')}</th>
                {!readOnly && <th>{t('columns.action')}</th>}
              </tr>
            </thead>
            <tbody>
              {itemsToPick.map((line, idx) => {
                const remaining = line.remaining ?? String(parseFloat(line.quantity) - parseFloat(line.quantityPicked || '0'));
                return (
                  <tr key={`${line.salesOrderLineId}-${idx}`}>
                    <td>
                      <div className="flex items-center gap-1.5">
                        <div className="font-bold">{line.productNumber || line.productId?.slice(0, 8)}</div>
                        {line.hasAllocation && (
                          /* eslint-disable-next-line i18next/no-literal-string -- Material UI Icon */
                          <span className="material-symbols-outlined indicator-icon text-[var(--accent)] [font-variation-settings:'FILL'_1]" title={t('tooltips.stockSpecificallyOrdered')}>bookmark</span>
                        )}
                      </div>
                      {line.productDescription && (
                        <div className="text-xs text-[var(--text-muted)] truncate max-w-[200px]">
                          {line.productDescription}
                        </div>
                      )}
                    </td>
                    <td>
                      {readOnly ? (
                        <span className="text-sm font-mono text-[var(--text-secondary)]">
                          {line.availableBins?.[0]?.binName || '-'}
                        </span>
                      ) : (
                        <select
                          className="input text-sm py-1 px-2 w-48"
                          value={pickInputs[line.salesOrderLineId]?.binId || ''}
                          onChange={(e) =>
                            onPickInputChange?.(line.salesOrderLineId, {
                              ...pickInputs[line.salesOrderLineId],
                              binId: e.target.value,
                            })
                          }
                        >
                          <option value="" disabled>
                            {t('selectBin')}
                          </option>
                          {(line.availableBins || []).map((b) => (
                            <option key={b.binId} value={b.binId}>
                              {b.binName} {t('qtyOption', { qty: parseFloat(b.onHand) })}
                            </option>
                          ))}
                        </select>
                      )}
                    </td>
                    <td className="text-right">
                      <div>{parseFloat(line.quantity).toLocaleString()}</div>
                    </td>
                    <td className="text-right">
                      <div>{parseFloat(remaining).toLocaleString()}</div>
                    </td>
                    <td className="text-right">
                      <div>{parseFloat(line.onHand || '0').toLocaleString()}</div>
                    </td>
                    <td className="text-right">
                      {readOnly ? (
                        <span className="text-xs text-[var(--text-muted)]">-</span>
                      ) : (
                        <div className="flex justify-end">
                          <input
                            type="number"
                            min="0.01"
                            step="0.01"
                            max={Math.min(parseFloat(remaining), parseFloat(line.onHand || '0'))}
                            value={pickInputs[line.salesOrderLineId]?.quantity || ''}
                            onChange={(e) =>
                              onPickInputChange?.(line.salesOrderLineId, {
                                ...pickInputs[line.salesOrderLineId],
                                quantity: e.target.value,
                              })
                            }
                            className="input w-[80px] text-right py-0.5 px-1.5 text-[13px]"
                          />
                        </div>
                      )}
                    </td>
                    {!readOnly && (
                      <td>
                        <Button
                          type="button"
                          onClick={() => onPickLine?.(line.salesOrderLineId)}
                          disabled={
                            isSubmitting ||
                            !pickInputs[line.salesOrderLineId]?.quantity ||
                            !pickInputs[line.salesOrderLineId]?.binId
                          }
                          variant="primary"
                          size="sm"
                        >
                          {t('buttons.pick')}
                        </Button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Mobile cards for To Pick */}
          <div className="flex flex-col gap-3 lg:hidden">
            {itemsToPick.map((line, idx) => {
              const remaining = line.remaining ?? String(parseFloat(line.quantity) - parseFloat(line.quantityPicked || '0'));
              return (
                <div
                  key={`mobile-topick-${line.salesOrderLineId}-${idx}`}
                  className="bg-[var(--bg-primary)] p-3 rounded-lg border border-[var(--border)]"
                >
                  <div className="flex justify-between items-start mb-2">
                    <div className="min-w-0 flex-1 pr-2">
                      <div className="flex items-center gap-1.5">
                        <div className="font-bold text-sm text-[var(--text-primary)] truncate">
                          {line.productNumber || line.productId?.slice(0, 8)}
                        </div>
                        {line.hasAllocation && (
                          /* eslint-disable-next-line i18next/no-literal-string -- Material UI Icon */
                          <span className="material-symbols-outlined indicator-icon text-[var(--accent)] text-sm shrink-0 [font-variation-settings:'FILL'_1]" title={t('tooltips.stockSpecificallyOrdered')}>bookmark</span>
                        )}
                      </div>
                      {line.productDescription && (
                        <div className="text-xs text-[var(--text-muted)] truncate">{line.productDescription}</div>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 mb-3 bg-[var(--bg-card)] p-2 rounded border border-[var(--border)]">
                    <div>
                      <div className="text-[10px] text-[var(--text-muted)] uppercase mb-0.5">{t('columns.ordered')}</div>
                      <div className="text-xs font-medium">{parseFloat(line.quantity).toLocaleString()}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-[var(--text-muted)] uppercase mb-0.5">{t('columns.remaining')}</div>
                      <div className="text-xs font-medium">{parseFloat(remaining).toLocaleString()}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-[var(--text-muted)] uppercase mb-0.5">{t('columns.onHand')}</div>
                      <div className="text-xs font-medium">{parseFloat(line.onHand || '0').toLocaleString()}</div>
                    </div>
                  </div>

                  {!readOnly && (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <div className="text-xs font-bold w-16 text-[var(--text-muted)]">{t('columns.binLocation')}</div>
                        <select
                          className="input text-sm flex-1 py-1"
                          value={pickInputs[line.salesOrderLineId]?.binId || ''}
                          onChange={(e) =>
                            onPickInputChange?.(line.salesOrderLineId, {
                              ...pickInputs[line.salesOrderLineId],
                              binId: e.target.value,
                            })
                          }
                        >
                          <option value="" disabled>
                            {t('selectBin')}
                          </option>
                          {(line.availableBins || []).map((b) => (
                            <option key={b.binId} value={b.binId}>
                              {b.binName} {t('qtyOption', { qty: parseFloat(b.onHand) })}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-2">
                          <div className="text-xs font-bold w-16 text-[var(--text-muted)]">{t('columns.pickQty')}</div>
                          <input
                            type="number"
                            min="0.01"
                            step="0.01"
                            max={Math.min(parseFloat(remaining), parseFloat(line.onHand || '0'))}
                            value={pickInputs[line.salesOrderLineId]?.quantity || ''}
                            onChange={(e) =>
                              onPickInputChange?.(line.salesOrderLineId, {
                                ...pickInputs[line.salesOrderLineId],
                                quantity: e.target.value,
                              })
                            }
                            className="input flex-1 py-1 px-2 text-right"
                          />
                        </div>
                        <Button
                          type="button"
                          onClick={() => onPickLine?.(line.salesOrderLineId)}
                          disabled={
                            isSubmitting ||
                            !pickInputs[line.salesOrderLineId]?.quantity ||
                            !pickInputs[line.salesOrderLineId]?.binId
                          }
                          variant="primary"
                          className="w-full justify-center mt-2"
                        >
                          {t('buttons.pick')}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 3. Unavailable Table */}
      {unavailableItems.length > 0 && (
        <div>
          <h4 className="section-heading !mb-4 !text-[var(--text-muted)]">{t('unavailable')}</h4>
          <table className="table-lines opacity-70 hidden lg:table">
            <thead>
              <tr>
                <th>{t('columns.product')}</th>
                <th>{t('columns.binLocation')}</th>
                <th className="text-right">{t('columns.ordered')}</th>
                <th className="text-right">{t('columns.remaining')}</th>
                <th className="text-right">{t('columns.onHand')}</th>
                <th className="text-right">{t('columns.pickQty')}</th>
                <th>{t('columns.action')}</th>
              </tr>
            </thead>
            <tbody>
              {unavailableItems.map((line, idx) => {
                const remaining = line.remaining ?? line.quantity;
                return (
                  <tr key={`${line.salesOrderLineId}-${idx}`}>
                    <td>
                      <div className="font-bold">{line.productNumber || line.productId?.slice(0, 8)}</div>
                      {line.productDescription && (
                        <div className="text-xs text-[var(--text-muted)] truncate max-w-[200px]">
                          {line.productDescription}
                        </div>
                      )}
                    </td>
                    <td className="text-[var(--text-muted)]">-</td>
                    <td className="text-right">
                      <div>{parseFloat(line.quantity).toLocaleString()}</div>
                    </td>
                    <td className="text-right">
                      <div className="text-[var(--text-muted)]">{parseFloat(remaining).toLocaleString()}</div>
                    </td>
                    <td className="text-right">
                      <div className="text-[var(--text-muted)]">{parseFloat(line.onHand || '0').toLocaleString()}</div>
                    </td>
                    <td className="text-right text-[var(--text-muted)]">-</td>
                    <td>
                      <span className="text-xs italic text-[var(--text-muted)]">{t('outOfStock')}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div className="flex flex-col gap-3 lg:hidden opacity-70">
            {unavailableItems.map((line, idx) => (
              <div
                key={`mobile-unavail-${line.salesOrderLineId}-${idx}`}
                className="bg-[var(--bg-primary)] p-3 rounded-lg border border-[var(--border)]"
              >
                <div className="flex justify-between items-start mb-2">
                  <div className="min-w-0 flex-1 pr-2">
                    <div className="font-bold text-sm text-[var(--text-primary)] truncate">
                      {line.productNumber || line.productId?.slice(0, 8)}
                    </div>
                    {line.productDescription && (
                      <div className="text-xs text-[var(--text-muted)] truncate">{line.productDescription}</div>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <span className="text-xs italic text-[var(--text-muted)]">{t('outOfStock')}</span>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 bg-[var(--bg-card)] p-2 rounded border border-[var(--border)]">
                  <div>
                    <div className="text-[10px] text-[var(--text-muted)] uppercase mb-0.5">{t('columns.ordered')}</div>
                    <div className="text-xs font-medium">{parseFloat(line.quantity).toLocaleString()}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-[var(--text-muted)] uppercase mb-0.5">{t('columns.remaining')}</div>
                    <div className="text-xs font-medium text-[var(--text-muted)]">
                      {parseFloat(line.remaining ?? line.quantity).toLocaleString()}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-[var(--text-muted)] uppercase mb-0.5">{t('columns.onHand')}</div>
                    <div className="text-xs font-medium text-[var(--text-muted)]">
                      {parseFloat(line.onHand || '0').toLocaleString()}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4. Shipped Table */}
      {shippedItems.length > 0 && (
        <div>
          <h4 className="section-heading !mb-4 !text-[var(--text-muted)]">{t('shipped')}</h4>
          <table className="table-lines opacity-70 hidden lg:table">
            <thead>
              <tr>
                <th>{t('columns.product')}</th>
                <th>{t('columns.binLocation')}</th>
                <th className="text-right">{t('columns.ordered')}</th>
                <th className="text-right">{t('columns.remaining')}</th>
                <th className="text-right">{t('columns.onHand')}</th>
                <th className="text-right">{t('columns.pickQty')}</th>
                <th>{t('columns.action')}</th>
              </tr>
            </thead>
            <tbody>
              {shippedItems.map((pick) => (
                <tr key={pick.pickId}>
                  <td>
                    <div className="font-bold">{pick.line?.productNumber || tCommon('unknown')}</div>
                    {pick.line?.productDescription && (
                      <div className="text-xs text-[var(--text-muted)] truncate max-w-[200px]">
                        {pick.line.productDescription}
                      </div>
                    )}
                  </td>
                  <td className="text-[var(--text-muted)]">{pick.binName || '-'}</td>
                  <td className="text-right text-[var(--text-muted)]">
                    <div>{pick.line ? parseFloat(pick.line.quantity).toLocaleString() : '-'}</div>
                  </td>
                  <td className="text-right text-[var(--text-muted)]">
                    <div>{pick.line ? parseFloat(pick.line.remaining || '0').toLocaleString() : '-'}</div>
                  </td>
                  <td className="text-right text-[var(--text-muted)]">
                    <div>{pick.line ? parseFloat(pick.line.onHand || '0').toLocaleString() : '-'}</div>
                  </td>
                  <td className="text-right">
                    <div className="font-semibold">{parseFloat(pick.quantity).toLocaleString()}</div>
                  </td>
                  <td>
                    <span className="ml-2 text-xs font-bold text-[var(--text-muted)] inline-flex items-center">
                      <span className="material-symbols-outlined text-[14px] mr-1">local_shipping</span>
                      {t('statuses.dispatched')}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 5. Non-Physical Items Table */}
      {nonPhysicalItems.length > 0 && (
        <div>
          <h4 className="section-heading !mb-4 !text-[var(--text-muted)]">Non-Stock Items</h4>
          <table className="table-lines opacity-70 hidden lg:table">
            <thead>
              <tr>
                <th>{t('columns.product')}</th>
                <th className="text-right">{t('columns.ordered')}</th>
                <th>{t('columns.action')}</th>
              </tr>
            </thead>
            <tbody>
              {nonPhysicalItems.map((line, idx) => (
                <tr key={`non-physical-${line.salesOrderLineId}-${idx}`}>
                  <td>
                    <div className="font-bold">
                      {line.productNumber}
                      <span className="ml-2 uppercase text-[10px] bg-[var(--bg-secondary)] px-1.5 py-0.5 rounded font-bold text-[var(--text-muted)]">
                        {line.productType}
                      </span>
                    </div>
                    {line.productDescription && (
                      <div className="text-xs text-[var(--text-muted)] truncate max-w-[250px]">
                        {line.productDescription}
                      </div>
                    )}
                  </td>
                  <td className="text-right text-[var(--text-muted)]">
                    <div>{parseFloat(line.quantity).toLocaleString()}</div>
                  </td>
                  <td>
                    <span className="ml-2 text-xs text-[var(--text-muted)] inline-flex items-center">
                      Not Required
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

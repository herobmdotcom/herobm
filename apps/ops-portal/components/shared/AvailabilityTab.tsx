'use client';

import React, { Fragment, useMemo } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import {
  isPhysicalProductLine,
  isStockedProductLine,
  calculateAvailableQuantity,
  CUSTOM_LINE_ID,
  LEGACY_CUSTOM_LINE_ID,
} from '@herobm/shared';
import { DataTable } from './DataTable';

export interface AvailabilityLineItem {
  salesOrderLineId?: string;
  purchaseOrderLineId?: string;
  id?: string;
  lineNumber?: number | string;
  productId?: string | null;
  productNumber?: string | null;
  productDescription?: string | null;
  productType?: string | null;
  structureType?: string | null;
  parentLineId?: string | null;
  quantity?: number | string | null;
  quantityPicked?: number | string | null;
  fulfillmentLocationId?: string | null;
  unitOfMeasure?: string | null;
  baseUom?: string | null;
}

export interface AvailabilityInventoryLevel {
  inventoryLevelId?: string;
  productId: string;
  locationId: string;
  locationNo?: string;
  locationName?: string;
  quantityOnHand?: number | string | null;
  quantityCommitted?: number | string | null;
  quantityReserved?: number | string | null;
  quantityOnOrder?: number | string | null;
  quantityAvailable?: number | string | null;
}

export interface AvailabilityTabProps<T extends AvailabilityLineItem = AvailabilityLineItem> {
  lines: T[];
  inventoryData: AvailabilityInventoryLevel[];
  inventoryLoading: boolean;
  targetLocationId?: string | null;
  context?: 'sales' | 'purchase';
  gapMap?: Record<string, import('@herobm/shared').InventoryGap>;
  activeBackorders?: Set<string>;
  isShipped?: boolean;
  isPreConfirmation?: boolean;
  emptyMessage?: string;
  loadingMessage?: string;
}

function isCustomProduct(productId?: string | null): boolean {
  return (
    !productId ||
    productId === CUSTOM_LINE_ID ||
    productId === LEGACY_CUSTOM_LINE_ID
  );
}

const SUB_COMPONENT_PREFIX = '\u21B3';

export function AvailabilityTab<T extends AvailabilityLineItem = AvailabilityLineItem>({
  lines = [],
  inventoryData = [],
  inventoryLoading,
  targetLocationId,
  context = 'sales',
  gapMap = {},
  activeBackorders = new Set(),
  isShipped = false,
  isPreConfirmation = true,
  emptyMessage,
  loadingMessage,
}: AvailabilityTabProps<T>) {
  const t = useTranslations('common');

  const kitParentLineIds = useMemo(() => {
    const ids = new Set<string>();
    for (const line of lines || []) {
      const lineId = line.salesOrderLineId || line.purchaseOrderLineId || line.id;
      if (line.structureType === 'kit' && line.productType === 'non-stock') {
        if (lineId) ids.add(lineId);
      }
    }
    return ids;
  }, [lines]);

  const filteredLines = useMemo(() => {
    return (lines || []).filter((line) => {
      // 1. Exclude intangible lines (service, freight)
      if (!isPhysicalProductLine(line)) return false;

      // 2. Exclude 0-quantity lines
      const qty = parseFloat(String(line.quantity || '0'));
      if (qty <= 0) return false;

      return true;
    });
  }, [lines]);

  if (inventoryLoading) {
    return (
      <p className="text-sm text-[var(--text-muted)] py-8 text-center">
        {loadingMessage || t('availability.loading')}
      </p>
    );
  }

  const columns =
    context === 'purchase'
      ? [
          { header: t('availability.colLineNumber'), width: 32 },
          { header: t('availability.colProduct'), width: 100 },
          { header: t('availability.colDescription') },
          { header: t('availability.thisOrder'), width: 65, align: 'right' as const },
          { header: t('availability.colLocation'), width: 90, align: 'right' as const },
          { header: t('availability.colOnHand'), width: 65, align: 'right' as const },
          { header: t('availability.colCommitted'), width: 65, align: 'right' as const },
          { header: t('availability.colOrdered'), width: 65, align: 'right' as const },
          { header: t('availability.colReserved'), width: 65, align: 'right' as const },
          { header: t('availability.colAvail'), width: 65, align: 'right' as const },
        ]
      : [
          { header: t('availability.colLineNumber'), width: 32 },
          { header: t('availability.colProduct'), width: 100 },
          { header: t('availability.colDescription') },
          { header: t('availability.colQty'), width: 65, align: 'right' as const },
          { header: t('availability.colStatus'), width: 110 },
          { header: t('availability.colLocation'), align: 'right' as const },
          { header: t('availability.colAvail'), width: 70, align: 'right' as const },
        ];

  return (
    <DataTable
      data={filteredLines}
      keyExtractor={(line: T, idx: number) =>
        line.salesOrderLineId || line.purchaseOrderLineId || line.id || idx
      }
      emptyMessage={emptyMessage || t('availability.noLineItems')}
      columns={columns}
      renderCustomRow={(line: T, idx: number) => {
        const lineId = line.salesOrderLineId || line.purchaseOrderLineId || line.id || String(idx);
        const isCustom = isCustomProduct(line.productId);
        const isKitParent =
          (line.structureType === 'kit' && line.productType === 'non-stock') ||
          (line.productType === 'non-stock' && kitParentLineIds.has(lineId));
        const isComponent = Boolean(line.parentLineId);
        const isNonStock = line.productType === 'non-stock' || (!isCustom && !isStockedProductLine(line));

        const lineInventory = isCustom
          ? []
          : inventoryData.filter((inv) => inv.productId === line.productId);

        const totalAvail = lineInventory.reduce((sum, inv) => {
          const avail =
            inv.quantityAvailable != null
              ? parseFloat(String(inv.quantityAvailable || '0'))
              : calculateAvailableQuantity(
                  inv.quantityOnHand,
                  inv.quantityCommitted,
                  inv.quantityReserved,
                );
          return sum + avail;
        }, 0);

        const orderedQty = parseFloat(String(line.quantity || '0'));
        const gap = gapMap[lineId];
        const canFulfil = context === 'purchase' ? totalAvail >= orderedQty : !gap;

        const productCellContent = (
          <div className="flex items-center gap-1.5 flex-wrap">
            {isComponent && (
              <span className="text-slate-400 font-mono text-xs" title={t('availability.component')}>
                {SUB_COMPONENT_PREFIX}
              </span>
            )}
            {!isCustom && line.productId ? (
              <Link
                href={`/products/${line.productId}`}
                className="font-semibold text-xs text-[var(--accent)] no-underline hover:underline"
              >
                {line.productNumber || line.productId.substring(0, 8)}
              </Link>
            ) : (
              <span className="font-semibold text-xs">
                {line.productNumber || '—'}
              </span>
            )}
            {isKitParent && (
              <span className="badge badge-sm badge-secondary text-[10px]">
                {t('availability.kitParent')}
              </span>
            )}
            {isComponent && (
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 font-medium">
                {t('availability.component')}
              </span>
            )}
          </div>
        );

        /* ── Purchase Mode Row Rendering ────────────────────────── */
        if (context === 'purchase') {
          if (isKitParent || isNonStock) {
            return (
              <tr key={lineId}>
                <td className="text-[var(--text-muted)]">{line.lineNumber ?? idx + 1}</td>
                <td>{productCellContent}</td>
                <td className="text-xs text-[var(--text-muted)]">{line.productDescription || '—'}</td>
                <td className="text-right tabular-nums font-semibold">{orderedQty}</td>
                <td colSpan={6} className="text-center text-[var(--text-muted)] text-xs italic">
                  {isKitParent ? t('availability.fulfilledByComponents') : t('availability.nonStock')}
                </td>
              </tr>
            );
          }

          if (lineInventory.length === 0) {
            return (
              <tr key={lineId}>
                <td className="text-[var(--text-muted)]">{line.lineNumber ?? idx + 1}</td>
                <td>{productCellContent}</td>
                <td className="text-xs text-[var(--text-muted)]">{line.productDescription || '—'}</td>
                <td className="text-right tabular-nums font-semibold">{orderedQty}</td>
                <td colSpan={6} className="text-center text-[var(--text-muted)] text-xs">
                  {t('availability.noInventoryData')}
                </td>
              </tr>
            );
          }

          return (
            <Fragment key={lineId}>
              {lineInventory.map((inv, invIdx) => {
                const avail =
                  inv.quantityAvailable != null
                    ? parseFloat(String(inv.quantityAvailable || '0'))
                    : calculateAvailableQuantity(
                        inv.quantityOnHand,
                        inv.quantityCommitted,
                        inv.quantityReserved,
                      );

                return (
                  <tr key={`${lineId}-${inv.inventoryLevelId || inv.locationId}`}>
                    {invIdx === 0 && (
                      <>
                        <td rowSpan={lineInventory.length} className="text-[var(--text-muted)]">
                          {line.lineNumber ?? idx + 1}
                        </td>
                        <td rowSpan={lineInventory.length}>{productCellContent}</td>
                        <td rowSpan={lineInventory.length} className="text-xs">
                          {line.productDescription || '—'}
                        </td>
                        <td
                          rowSpan={lineInventory.length}
                          className="text-right tabular-nums font-semibold"
                        >
                          {orderedQty}
                        </td>
                      </>
                    )}
                    <td className="text-right text-xs">
                      {line.productId && !isCustom ? (
                        <Link
                          href={`/products/${line.productId}?tab=inventory`}
                          className={`no-underline hover:underline ${
                            inv.locationId === targetLocationId
                              ? 'text-[var(--accent)] font-semibold'
                              : 'text-[var(--text-muted)]'
                          }`}
                        >
                          {inv.locationName || inv.locationNo}
                        </Link>
                      ) : (
                        inv.locationName || inv.locationNo
                      )}
                    </td>
                    <td className="text-right tabular-nums text-xs">
                      {parseFloat(String(inv.quantityOnHand || '0'))}
                    </td>
                    <td className="text-right tabular-nums text-xs">
                      {parseFloat(String(inv.quantityCommitted || '0'))}
                    </td>
                    <td className="text-right tabular-nums text-xs">
                      {parseFloat(String(inv.quantityOnOrder || '0'))}
                    </td>
                    <td className="text-right tabular-nums text-xs">
                      {parseFloat(String(inv.quantityReserved || '0'))}
                    </td>
                    <td
                      className={`text-right tabular-nums font-semibold text-xs ${
                        avail > 0 ? 'text-emerald-600' : 'text-rose-600'
                      }`}
                    >
                      {avail}
                    </td>
                  </tr>
                );
              })}
            </Fragment>
          );
        }

        /* ── Sales Mode Row Rendering ───────────────────────────── */
        const renderSalesStatusBadge = () => {
          if (isShipped) {
            return <span className="text-emerald-600 font-medium">{t('availability.statusShipped')}</span>;
          }
          if (!isPreConfirmation) {
            const pickedQty = parseFloat(String(line.quantityPicked || '0'));
            if (pickedQty > 0 && pickedQty >= orderedQty) {
              return <span className="text-emerald-600 font-medium">{t('availability.statusPicked')}</span>;
            }

            const isBackordered =
              line.productId && activeBackorders.has(line.productId);
            if (isBackordered) {
              return <span className="text-amber-600 font-medium">{t('availability.statusBackordered')}</span>;
            }

            const locInv = lineInventory.find((i) => i.locationId === targetLocationId);
            const isAtRisk = locInv && parseFloat(String(locInv.quantityAvailable || '0')) < 0;
            if (isAtRisk) {
              return <span className="text-rose-600 font-medium">{t('availability.statusAtRisk')}</span>;
            }

            return <span className="text-emerald-600 font-medium">{t('availability.statusLocal')}</span>;
          }

          // Draft / Pre-confirmation
          if (canFulfil) {
            return <span className="text-emerald-600 font-medium">{t('availability.statusLocal')}</span>;
          }
          if (gap && totalAvail >= gap.orderedQuantity) {
            return <span className="text-amber-600 font-medium">{t('availability.statusOthers')}</span>;
          }
          return <span className="text-rose-600 font-medium">{t('availability.statusShortage')}</span>;
        };

        if (isKitParent) {
          return (
            <tr key={lineId}>
              <td className="text-[var(--text-muted)]">{line.lineNumber ?? idx + 1}</td>
              <td>{productCellContent}</td>
              <td className="text-xs text-[var(--text-muted)]">{line.productDescription || '—'}</td>
              <td className="text-right tabular-nums font-semibold">{orderedQty}</td>
              <td>
                <span className="text-slate-500 font-medium text-xs">
                  {t('availability.statusKitParent')}
                </span>
              </td>
              <td colSpan={2} className="text-right text-xs text-[var(--text-muted)] italic">
                {t('availability.fulfilledByComponents')}
              </td>
            </tr>
          );
        }

        if (isNonStock) {
          return (
            <tr key={lineId}>
              <td className="text-[var(--text-muted)]">{line.lineNumber ?? idx + 1}</td>
              <td>{productCellContent}</td>
              <td className="text-xs text-[var(--text-muted)]">{line.productDescription || '—'}</td>
              <td className="text-right tabular-nums font-semibold">{orderedQty}</td>
              <td>
                <span className="text-slate-500 font-medium text-xs">
                  {t('availability.statusNonStock')}
                </span>
              </td>
              <td colSpan={2} className="text-right text-xs text-[var(--text-muted)] italic">
                {t('availability.noStockTracking')}
              </td>
            </tr>
          );
        }

        if (lineInventory.length === 0) {
          return (
            <tr key={lineId}>
              <td className="text-[var(--text-muted)]">{line.lineNumber ?? idx + 1}</td>
              <td>{productCellContent}</td>
              <td className="text-xs text-[var(--text-muted)]">{line.productDescription || '—'}</td>
              <td className="text-right tabular-nums font-semibold">{orderedQty}</td>
              <td>
                <span className="text-rose-600 font-medium text-xs">
                  {t('availability.statusShortage')}
                </span>
              </td>
              <td colSpan={2} className="text-center text-[var(--danger)] text-xs italic">
                {t('availability.noInventoryFound')}
              </td>
            </tr>
          );
        }

        return (
          <Fragment key={lineId}>
            {lineInventory.map((inv, invIdx) => (
              <tr key={`${lineId}-${inv.inventoryLevelId || inv.locationId}`}>
                {invIdx === 0 && (
                  <>
                    <td rowSpan={lineInventory.length} className="text-[var(--text-muted)]">
                      {line.lineNumber ?? idx + 1}
                    </td>
                    <td rowSpan={lineInventory.length}>{productCellContent}</td>
                    <td rowSpan={lineInventory.length} className="text-xs">
                      {line.productDescription || '—'}
                    </td>
                    <td
                      rowSpan={lineInventory.length}
                      className="text-right tabular-nums font-semibold"
                    >
                      {orderedQty}
                    </td>
                    <td rowSpan={lineInventory.length}>
                      {renderSalesStatusBadge()}
                    </td>
                  </>
                )}
                <td className="text-right text-xs">
                  {line.productId && !isCustom ? (
                    <Link
                      href={`/products/${line.productId}?tab=inventory`}
                      className={`no-underline hover:underline ${
                        inv.locationId === targetLocationId
                          ? 'text-[var(--accent)] font-semibold'
                          : 'text-[var(--text-muted)]'
                      }`}
                    >
                      {inv.locationName || inv.locationNo}
                    </Link>
                  ) : (
                    inv.locationName || inv.locationNo
                  )}
                </td>
                <td
                  className={`text-right tabular-nums font-semibold text-xs ${
                    parseFloat(String(inv.quantityAvailable || '0')) > 0
                      ? 'text-[var(--text-primary)]'
                      : 'text-[var(--danger)]'
                  }`}
                >
                  {parseFloat(String(inv.quantityAvailable || '0'))}
                </td>
              </tr>
            ))}
          </Fragment>
        );
      }}
      mobileCard={(line: T, idx: number) => {
        const lineId = line.salesOrderLineId || line.purchaseOrderLineId || line.id || String(idx);
        const isCustom = isCustomProduct(line.productId);
        const isKitParent =
          (line.structureType === 'kit' && line.productType === 'non-stock') ||
          (line.productType === 'non-stock' && kitParentLineIds.has(lineId));
        const isComponent = Boolean(line.parentLineId);
        const isNonStock = line.productType === 'non-stock' || (!isCustom && !isStockedProductLine(line));

        const lineInventory = isCustom
          ? []
          : inventoryData.filter((inv) => inv.productId === line.productId);

        const totalAvail = lineInventory.reduce((sum, inv) => {
          const avail =
            inv.quantityAvailable != null
              ? parseFloat(String(inv.quantityAvailable || '0'))
              : calculateAvailableQuantity(
                  inv.quantityOnHand,
                  inv.quantityCommitted,
                  inv.quantityReserved,
                );
          return sum + avail;
        }, 0);

        const orderedQty = parseFloat(String(line.quantity || '0'));
        const gap = gapMap[lineId];
        const canFulfil = context === 'purchase' ? totalAvail >= orderedQty : !gap;

        return (
          <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] p-4 flex flex-col">
            <div className="flex justify-between items-start gap-2 mb-2">
              <div className="flex items-center gap-1.5 flex-wrap">
                {isComponent && (
                  /* eslint-disable-next-line i18next/no-literal-string -- Hierarchy indicator symbol */
                  <span className="text-slate-400 font-mono text-xs">↳</span>
                )}
                <div className="font-semibold text-sm text-[var(--accent)]">
                  {line.productNumber || line.productId?.substring(0, 8) || '—'}
                </div>
                {isKitParent && (
                  <span className="badge badge-sm badge-secondary text-[10px]">
                    {t('availability.kitParent')}
                  </span>
                )}
                {isComponent && (
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 font-medium">
                    {t('availability.component')}
                  </span>
                )}
              </div>
              <div className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded font-medium">
                {line.lineNumber ?? idx + 1}
              </div>
            </div>

            <div className="text-sm text-slate-600 font-medium mb-3">
              {line.productDescription || '—'}
            </div>

            <div className="flex justify-between items-center py-2 border-t border-slate-100">
              <span className="text-xs font-medium text-slate-500">
                {context === 'purchase' ? t('availability.thisOrder') : t('availability.colQty')}
              </span>
              <span className="text-sm font-semibold">{orderedQty}</span>
            </div>

            {isKitParent ? (
              <div className="text-xs text-slate-500 italic py-2 bg-slate-50 rounded text-center border border-slate-100">
                {t('availability.fulfilledByComponents')}
              </div>
            ) : isNonStock ? (
              <div className="text-xs text-slate-500 italic py-2 bg-slate-50 rounded text-center border border-slate-100">
                {t('availability.nonStock')} — {t('availability.noStockTracking')}
              </div>
            ) : lineInventory.length === 0 ? (
              <div className="text-sm text-rose-500 italic text-center py-2 bg-rose-50 rounded border border-rose-100">
                {t('availability.noInventoryFound')}
              </div>
            ) : (
              <>
                {context === 'sales' && (
                  <div className="flex justify-between items-center py-2 border-b border-slate-100">
                    <span className="text-xs font-medium text-slate-500">
                      {t('availability.colStatus')}
                    </span>
                    <span className="text-sm font-medium">
                      {isShipped ? (
                        <span className="text-emerald-600">{t('availability.statusShipped')}</span>
                      ) : !isPreConfirmation ? (
                        parseFloat(String(line.quantityPicked || '0')) > 0 &&
                        parseFloat(String(line.quantityPicked || '0')) >= orderedQty ? (
                          <span className="text-emerald-600">{t('availability.statusPicked')}</span>
                        ) : line.productId && activeBackorders.has(line.productId) ? (
                          <span className="text-amber-600">{t('availability.statusBackordered')}</span>
                        ) : (
                          <span className="text-emerald-600">{t('availability.statusLocal')}</span>
                        )
                      ) : canFulfil ? (
                        <span className="text-emerald-600">{t('availability.statusLocal')}</span>
                      ) : gap && totalAvail >= gap.orderedQuantity ? (
                        <span className="text-amber-600">{t('availability.statusOthers')}</span>
                      ) : (
                        <span className="text-rose-600">{t('availability.statusShortage')}</span>
                      )}
                    </span>
                  </div>
                )}

                <div className="mt-3 flex flex-col gap-2">
                  <span className="text-xs font-medium text-slate-500">
                    {t('availability.colLocation')}:
                  </span>
                  {lineInventory.map((inv) => {
                    const avail =
                      inv.quantityAvailable != null
                        ? parseFloat(String(inv.quantityAvailable || '0'))
                        : calculateAvailableQuantity(
                            inv.quantityOnHand,
                            inv.quantityCommitted,
                            inv.quantityReserved,
                          );

                    return (
                      <div
                        key={inv.inventoryLevelId || inv.locationId}
                        className="bg-slate-50 rounded p-2 text-xs flex flex-col gap-1 border border-slate-100"
                      >
                        <div className="flex justify-between font-medium">
                          {line.productId && !isCustom ? (
                            <Link
                              href={`/products/${line.productId}?tab=inventory`}
                              className={inv.locationId === targetLocationId ? 'text-[var(--accent)]' : ''}
                            >
                              {inv.locationName || inv.locationNo}
                            </Link>
                          ) : (
                            <span>{inv.locationName || inv.locationNo}</span>
                          )}
                          <span className={avail >= orderedQty ? 'text-emerald-600' : 'text-rose-600'}>
                            {avail} {t('availability.colAvail')}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        );
      }}
    />
  );
}

export default AvailabilityTab;

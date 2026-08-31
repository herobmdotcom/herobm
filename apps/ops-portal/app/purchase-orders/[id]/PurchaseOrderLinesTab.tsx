'use client';

import { use, useMemo, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { calculateAvailableQuantity, isStockedProductLine, PURCHASE_ORDER_STATE, calculateUomPriceAdjustment, CUSTOM_LINE_ID, LineType } from '@herobm/shared';
import ProductSearchInput from '@/components/shared/ProductSearchInput';
import { Button } from '@/components/shared/Button';
import ActivityTimeline from '@/components/shared/ActivityTimeline';
import { formatAmount } from '@/lib/currency';
import type { ProductUom } from '@herobm/shared';
import { useTranslations } from 'next-intl';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import EntityHeader from '@/components/shared/EntityHeader';
import DetailsLayout from '@/components/shared/DetailsLayout';
import PageNav from '@/components/shared/PageNav';
import LocationSelect from '@/components/shared/LocationSelect';
import Tabs from '@/components/shared/Tabs';
import { DataTable, MobileCardField, DataTableColumn } from '@/components/shared/DataTable';
import { AvailabilityTab } from '@/components/shared/AvailabilityTab';
import { OrderLinesTable } from '@/components/shared/OrderLinesTable';

import type { OrderLine, TaxCategory, OrderDetail, InventoryLevel, Allocation } from './types';
import type { PurchaseInvoice, PurchaseInvoiceLine } from '@/lib/purchase-order-utils';
import { getTaxLabel } from './types';

import StateBadge from '@/components/StateBadge';
import { ValidState } from '@/types/states';

function isNonTrackedReceivedLine(line: OrderLine): boolean {
  const isZero = parseFloat(line.quantity || '0') <= 0;
  const isNonStock = (line.productType && line.productType !== 'inventory') ||
                     line.productNumber === 'FRT' ||
                     !isStockedProductLine(line);
  return isZero || isNonStock;
}

function TaxLabel({ category }: { category: TaxCategory }) {
  if (!category) return null;
  return <>{getTaxLabel(category)}</>;
}

interface PurchaseOrderLinesTabProps {
  order: OrderDetail;
  inventoryData: InventoryLevel[];
  inventoryLoading: boolean;
  allocations: Allocation[];
  invoices: PurchaseInvoice[];
  activeTab: 'lines' | 'availability' | 'status';
  setActiveTab: (tab: 'lines' | 'availability' | 'status') => void;
  isLinesEditable: boolean;
  saving: boolean;
  updateLine: (lineId: string, field: string, value: string | number | boolean | null | undefined) => Promise<void>;
  updateLineFields: (lineId: string, payload: Record<string, unknown>) => Promise<void>;
  removeLine: (lineId: string) => void;
  addLineFromProduct: (product: import('@/components/shared/ProductSearchInput').Product) => void;
  addBlankLine: () => void;
  addCommentLine?: () => void;
  subtotal: number;
  totalTax: number;
  taxCategories: TaxCategory[];
  tPurchase: (key: string, args?: Record<string, string | number>) => string;
  tCommon: (key: string, args?: Record<string, string | number>) => string;
}

export default function PurchaseOrderLinesTab({
  order,
  inventoryData,
  inventoryLoading,
  allocations,
  invoices,
  activeTab,
  setActiveTab,
  isLinesEditable,
  saving,
  updateLine,
  updateLineFields,
  removeLine,
  addLineFromProduct,
  addBlankLine,
  addCommentLine,
  subtotal,
  totalTax,
  taxCategories,
  tPurchase,
  tCommon,
}: PurchaseOrderLinesTabProps) {

  const prevLineCountRef = useRef<number | null>(null);
  useEffect(() => {
    const lineCount = (order?.lines || []).length;
    if (prevLineCountRef.current !== null && lineCount > prevLineCountRef.current) {
      const el = document.getElementById('po-lines-section-bottom') || document.getElementById('lines-section');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
    prevLineCountRef.current = lineCount;
  }, [order?.lines?.length]);

  return (
    <>

        <div id="lines-section" className="card">
          <div className="mb-4">
            <Tabs<'lines' | 'availability' | 'status'>
              tabs={[
                { id: 'lines' as const, label: tPurchase('lineItems') },
                { id: 'availability' as const, label: tPurchase('availability') },
                ...(order.stateCode !== PURCHASE_ORDER_STATE.DRAFT
                  ? [{ id: 'status' as const, label: tPurchase('statusTab') }]
                  : []),
              ]}
              activeTab={activeTab}
              onChange={setActiveTab}
              actions={
                isLinesEditable && activeTab === 'lines' ? (
                  <>
                    <div className="flex-1 min-w-[200px] max-w-sm">
                      <ProductSearchInput
                        onSelect={addLineFromProduct}
                        placeholder="Add product… (search)"
                      />
                    </div>
                    <Button
                      variant="secondary"
                      size="sm"
                      className="whitespace-nowrap"
                      onClick={addBlankLine}
                      disabled={saving}
                    >
                      {tPurchase('buttons.customLine')}
                    </Button>
                    {addCommentLine && (
                      <Button
                        variant="secondary"
                        size="sm"
                        className="whitespace-nowrap"
                        onClick={addCommentLine}
                        disabled={saving}
                      >
                        {tPurchase('buttons.commentLine')}
                      </Button>
                    )}
                  </>
                ) : undefined
              }
            />
          </div>

          {activeTab === 'lines' ? (
            <OrderLinesTable<OrderLine>
              lines={order.lines || []}
              currencyCode={order.currencyCode || 'EUR'}
              taxCategories={taxCategories as unknown as import('@/components/shared/OrderLinesTable').TaxCategory[]}
              mode="purchase"
              showReceived={true}
              isEditable={isLinesEditable}
              isSaving={saving}
              allowCatalogDescriptionEdit={false}
              subtotal={subtotal}
              onUpdateLine={(lineId, field, val) =>
                updateLine(
                  String(lineId),
                  field,
                  val as string | number | boolean | null | undefined
                )
              }
              onUpdateLineFields={(lineId, fields) => updateLineFields(String(lineId), fields)}
              onRemoveLine={(lineId) => removeLine(String(lineId))}
            />
          ) : activeTab === 'availability' ? (
            <AvailabilityTab
              lines={order.lines || []}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Safe cast to unified AvailabilityInventoryLevel
              inventoryData={inventoryData as any}
              inventoryLoading={inventoryLoading}
              targetLocationId={order.deliveryLocationId}
              context="purchase"
            />
          ) : activeTab === 'status' ? (
            /* Status / Bill Summary tab */
            <div className="overflow-x-auto">
              <DataTable
                  data={(order.lines || []).filter((line) => parseFloat(line.quantity || '0') > 0)}
                  keyExtractor={(line) => line.purchaseOrderLineId}
                  columns={[
                      { header: tPurchase('columns.lineNumber'), width: 32 },
                      { header: tPurchase('columns.product'), width: 100 },
                      { header: tPurchase('columns.description') },
                      { header: tPurchase('columns.ordered'), width: 65, align: 'right' },
                      { header: tPurchase('allocated'), width: 65, align: 'right' },
                      { header: tPurchase('columns.received'), width: 65, align: 'right' },
                      { header: tPurchase('columns.billed'), width: 65, align: 'right' },
                      { header: tPurchase('columns.remaining'), width: 65, align: 'right' }
                  ]}
                  emptyMessage={tPurchase('noLineItemsShort')}
                  renderCustomRow={(line) => {
                      const isNonTracked = isNonTrackedReceivedLine(line);
                      const ordered = parseFloat(line.quantity || '0');
                      const received = parseFloat(line.quantityReceived || '0');
                      const allocated = allocations.reduce((sum, alloc) => {
                          return sum + (alloc.purchaseOrderLineId === line.purchaseOrderLineId ? parseFloat(alloc.quantity) : 0);
                      }, 0);
                      const billed = invoices.reduce((sum, inv) => {
                          const invLine = inv.lines?.find((il) => il.purchaseOrderLineId === line.purchaseOrderLineId);
                          return sum + (invLine ? parseFloat(invLine.quantityInvoiced) : 0);
                      }, 0);
                      const remaining = Math.max(0, ordered - billed);
                      return (
                          <tr key={line.purchaseOrderLineId}>
                              <td className="text-[var(--text-muted)] text-xs">{line.lineNumber}</td>
                              <td className="font-semibold text-xs">
                                  {line.productNumber || line.productId?.substring(0, 8) || '—'}
                              </td>
                              <td className="text-xs">{line.productDescription || '—'}</td>
                              <td className="text-right tabular-nums text-xs">{ordered}</td>
                              <td className={`text-right tabular-nums text-xs ${allocated > 0 ? 'text-[var(--badge-shipped)] font-semibold' : 'font-normal'}`}>{allocated}</td>
                              <td className={`text-right tabular-nums text-xs ${!isNonTracked && received >= ordered && ordered > 0 ? 'text-[var(--badge-shipped)] font-semibold' : 'font-normal'}`}>
                                  {isNonTracked ? <span className="text-[var(--text-muted)]">—</span> : received}
                              </td>
                              <td className={`text-right tabular-nums text-xs ${billed >= received && received > 0 ? 'text-[var(--badge-shipped)] font-semibold' : 'font-normal'}`}>{billed}</td>
                              <td className={`text-right tabular-nums text-xs ${remaining === 0 ? 'text-[var(--text-muted)]' : ''}`}>{remaining}</td>
                          </tr>
                      );
                  }}
                  mobileCard={(line) => {
                      const isNonTracked = isNonTrackedReceivedLine(line);
                      const ordered = parseFloat(line.quantity || '0');
                      const received = parseFloat(line.quantityReceived || '0');
                      const allocated = allocations.reduce((sum, alloc) => {
                          return sum + (alloc.purchaseOrderLineId === line.purchaseOrderLineId ? parseFloat(alloc.quantity) : 0);
                      }, 0);
                      const billed = invoices.reduce((sum, inv) => {
                          const invLine = inv.lines?.find((il) => il.purchaseOrderLineId === line.purchaseOrderLineId);
                          return sum + (invLine ? parseFloat(invLine.quantityInvoiced) : 0);
                      }, 0);
                      const remaining = Math.max(0, ordered - billed);

                      return (
                          <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] p-4 flex flex-col">
                              <div className="flex justify-between items-start gap-2 mb-2">
                                  <div className="font-semibold text-sm text-[var(--accent)]">
                                      {line.productNumber || line.productId?.substring(0, 8) || '—'}
                                  </div>
                                  <div className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded font-medium">{line.lineNumber}</div>
                              </div>
                              <div className="text-sm text-slate-600 font-medium mb-3">
                                  {line.productDescription || '—'}
                              </div>
                              
                              <div className="flex flex-col gap-0 border-t border-slate-100 pt-1">
                                  <MobileCardField label={tPurchase('columns.ordered')} value={
                                      <span className="font-semibold">{ordered}</span>
                                  } />
                                  <MobileCardField label={tPurchase('allocated')} value={
                                      <span className={allocated > 0 ? 'font-semibold text-emerald-600' : ''}>{allocated}</span>
                                  } />
                                  <MobileCardField label={tPurchase('columns.received')} value={
                                      isNonTracked ? <span className="text-slate-400">—</span> : (
                                          <span className={received >= ordered && ordered > 0 ? 'font-semibold text-emerald-600' : ''}>{received}</span>
                                      )
                                  } />
                                  <MobileCardField label={tPurchase('columns.billed')} value={
                                      <span className={billed >= received && received > 0 ? 'font-semibold text-emerald-600' : ''}>{billed}</span>
                                  } />
                                  <MobileCardField label={tPurchase('columns.remaining')} value={
                                      <span className={remaining === 0 ? 'text-slate-400' : 'font-semibold text-amber-600'}>{remaining}</span>
                                  } />
                              </div>
                          </div>
                      );
                  }}
              />
            </div>
          ) : null}
          <div id="po-lines-section-bottom" className="h-px w-full" />
        </div>

    </>
  );
}

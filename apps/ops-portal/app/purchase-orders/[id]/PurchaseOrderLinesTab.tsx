'use client';

import { use, useMemo, useRef, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { calculateAvailableQuantity, isStockedProductLine, PURCHASE_ORDER_STATE, calculateUomPriceAdjustment, CUSTOM_LINE_ID, LineType } from '@herobm/shared';
import ProductQuickAddBar from '@/components/shared/ProductQuickAddBar';
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
import CreateProductSlideOver from '@/components/products/CreateProductSlideOver';

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
  saving?: boolean;
  updateLine: (lineId: string, field: string, value: unknown) => Promise<void>;
  updateLineFields: (lineId: string, payload: Record<string, unknown>) => Promise<void>;
  removeLine: (lineId: string) => void;
  reorderLines?: (lineIds: string[]) => Promise<void> | void;
  addLineFromProduct: (product: import('@/components/shared/ProductSearchInput').Product, quantity?: string, insertAtLineNumber?: number) => void | Promise<void>;
  addBlankLine: (insertAtLineNumber?: number) => void | Promise<void>;
  addCommentLine?: (insertAtLineNumber?: number) => void | Promise<void>;
  subtotal: number;
  totalTax: number;
  taxCategories: TaxCategory[];
  tPurchase?: (key: string, args?: Record<string, string | number>) => string;
  tCommon?: (key: string, args?: Record<string, string | number>) => string;
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
  reorderLines,
  addLineFromProduct,
  addBlankLine,
  addCommentLine,
  subtotal,
  totalTax,
  taxCategories,
  tPurchase: propTPurchase,
  tCommon: propTCommon,
}: PurchaseOrderLinesTabProps) {
  const tLocalPurchase = useTranslations('purchaseOrders');
  const tLocalCommon = useTranslations('common');
  const tPurchase = (key: string, args?: Record<string, string | number>) => propTPurchase ? propTPurchase(key, args) : tLocalPurchase(key as never, args as never);
  const tCommon = (key: string, args?: Record<string, string | number>) => propTCommon ? propTCommon(key, args) : tLocalCommon(key as never, args as never);

  const [isCreateProductOpen, setIsCreateProductOpen] = useState(false);
  const [insertAtLineNumber, setInsertAtLineNumber] = useState<number | null>(null);
  const [focusTrigger, setFocusTrigger] = useState(0);

  const prevLineCountRef = useRef<number | null>(null);
  useEffect(() => {
    const lineCount = (order?.lines || []).length;
    if (prevLineCountRef.current !== null && lineCount > prevLineCountRef.current && insertAtLineNumber === null) {
      const el = document.getElementById('po-lines-section-bottom') || document.getElementById('lines-section');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
    prevLineCountRef.current = lineCount;
  }, [order?.lines?.length, insertAtLineNumber]);

  const handleInsertAbove = (lineNum: number) => {
    setInsertAtLineNumber(lineNum);
    setFocusTrigger((prev) => prev + 1);
  };

  const handleAddProduct = async (product: import('@/components/shared/ProductSearchInput').Product, quantity?: string) => {
    const target = insertAtLineNumber ?? undefined;
    await addLineFromProduct(product, quantity, target);
    if (target !== undefined) setInsertAtLineNumber(null);
  };

  const handleAddBlank = async () => {
    const target = insertAtLineNumber ?? undefined;
    await addBlankLine(target);
    if (target !== undefined) setInsertAtLineNumber(null);
  };

  const handleAddComment = async () => {
    if (!addCommentLine) return;
    const target = insertAtLineNumber ?? undefined;
    await addCommentLine(target);
    if (target !== undefined) setInsertAtLineNumber(null);
  };

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
                    <div className="flex-1 min-w-[260px] max-w-md">
                      <ProductQuickAddBar
                        onAdd={handleAddProduct}
                        placeholder={tPurchase('placeholders.searchProduct')}
                        disabled={saving}
                        enableShortcut={activeTab === 'lines'}
                        insertAtLineNumber={isLinesEditable ? insertAtLineNumber : null}
                        onCancelInsert={() => setInsertAtLineNumber(null)}
                        focusTrigger={focusTrigger}
                      />
                    </div>
                    <Button
                      variant="secondary"
                      size="icon"
                      icon="add_box"
                      iconClassName="text-[18px]"
                      onClick={() => setIsCreateProductOpen(true)}
                      disabled={saving}
                      title={tPurchase('buttons.addProduct')}
                      aria-label={tPurchase('buttons.addProduct')}
                    />
                    <Button
                      variant="secondary"
                      size="icon"
                      icon="playlist_add"
                      iconClassName="text-[18px]"
                      onClick={() => void handleAddBlank()}
                      disabled={saving}
                      title={tPurchase('buttons.customLine')}
                      aria-label={tPurchase('buttons.customLine')}
                    />
                    {addCommentLine && (
                      <Button
                        variant="secondary"
                        size="icon"
                        icon="add_comment"
                        iconClassName="text-[18px]"
                        onClick={() => void handleAddComment()}
                        disabled={saving}
                        title={tPurchase('buttons.commentLine')}
                        aria-label={tPurchase('buttons.commentLine')}
                      />
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
              onUpdateLine={(lineId: string | number, field: string, val: unknown) =>
                updateLine(
                  String(lineId),
                  field,
                  val as string | number | boolean | null | undefined
                )
              }
              onUpdateLineFields={(lineId: string | number, fields: Record<string, unknown>) => updateLineFields(String(lineId), fields)}
              onRemoveLine={(lineId: string | number) => removeLine(String(lineId))}
              onReorderLines={isLinesEditable ? reorderLines : undefined}
              insertAtLineNumber={isLinesEditable ? insertAtLineNumber : null}
              onInsertAbove={isLinesEditable ? handleInsertAbove : undefined}
            />
          ) : activeTab === 'availability' ? (
            <AvailabilityTab
              lines={order.lines || []}
              inventoryData={inventoryData}
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
                                  <div className="text-xs text-[var(--text-muted)] bg-[var(--bg-secondary)] px-2 py-0.5 rounded font-medium">{line.lineNumber}</div>
                              </div>
                              <div className="text-sm text-[var(--text-secondary)] font-medium mb-3">
                                  {line.productDescription || '—'}
                              </div>
                              
                              <div className="flex flex-col gap-0 border-t border-[var(--border)] pt-1">
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

        <CreateProductSlideOver
          isOpen={isCreateProductOpen}
          onClose={() => setIsCreateProductOpen(false)}
          onSuccess={(prod) => {
            addLineFromProduct(prod as unknown as import('@/components/shared/ProductSearchInput').Product);
            setIsCreateProductOpen(false);
          }}
          vendorId={order.vendorId ?? undefined}
          vendorName={order.vendorName ?? undefined}
        />
    </>
  );
}

'use client';

import { use, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { calculateAvailableQuantity, PURCHASE_ORDER_STATE } from '@herobm/shared';
import ProductSearchInput from '@/components/shared/ProductSearchInput';
import { Button } from '@/components/shared/Button';
import ActivityTimeline from '@/components/shared/ActivityTimeline';
import { formatAmount } from '@/lib/currency';
import { calculateUomPriceAdjustment } from '@herobm/shared';
import type { ProductUom } from '@herobm/shared';
import { useTranslations } from 'next-intl';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import EntityHeader from '@/components/shared/EntityHeader';
import DetailsLayout from '@/components/shared/DetailsLayout';
import PageNav from '@/components/shared/PageNav';
import LocationSelect from '@/components/shared/LocationSelect';
import Tabs from '@/components/shared/Tabs';
import { DataTable, MobileCardField, DataTableColumn } from '@/components/shared/DataTable';

import type { OrderLine, TaxCategory, OrderDetail, InventoryLevel, Allocation } from './types';
import type { PurchaseInvoice, PurchaseInvoiceLine } from '@/lib/purchase-order-utils';
import { getTaxLabel } from './types';

import StateBadge from '@/components/StateBadge';
import { ValidState } from '@/types/states';

function TaxLabel({ category }: { category: TaxCategory }) {
  if (!category) return null;
  return <>{getTaxLabel(category)}</>;
}

interface CustomLineColumn extends DataTableColumn<OrderLine> {
  mobileCard?: (line: OrderLine, defaultRender?: React.ReactNode) => React.ReactNode;
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
  subtotal,
  totalTax,
  taxCategories,
  tPurchase,
  tCommon,
}: PurchaseOrderLinesTabProps) {

  const lineColumns: CustomLineColumn[] = useMemo(() => [
    {
        id: 'lineNumber',
        header: tPurchase('columns.lineNumber'), width: 40,
        render: (line) => <span className="text-[var(--text-muted)] font-normal relative">{line.lineNumber}</span>,
        mobileCard: () => null
    },
    {
        id: 'product',
        header: tPurchase('columns.product'),
        render: (line) => (
            <div className="font-semibold text-sm">
                {line.productId && line.productId !== '00000000-0000-0000-0000-000000000000' ? (
                    <Link href={`/products/${line.productId}`} className="text-[var(--accent)] no-underline hover:underline">
                        {line.productNumber || line.productId?.substring(0, 8)}
                    </Link>
                ) : (
                    line.productNumber || line.productId?.substring(0, 8) || '—'
                )}
            </div>
        )
    },
    {
        id: 'description',
        header: tPurchase('columns.description'),
        render: (line) => (
            (!line.productId || line.productId === '00000000-0000-0000-0000-000000000000') && isLinesEditable ? (
                <input
                    className="input w-full text-sm h-8"
                    defaultValue={line.productDescription || ''}
                    key={`desc-${line.purchaseOrderLineId}-${line.productDescription}`}
                    onBlur={(e) => {
                        if (e.target.value !== (line.productDescription || '')) {
                            updateLine(line.purchaseOrderLineId, 'productDescription', e.target.value);
                        }
                    }}
                    placeholder="Custom description..."
                />
            ) : (
                <span className="text-sm">{line.productDescription || '—'}</span>
            )
        )
    },
    {
        id: 'qty',
        header: tPurchase('columns.qty'), width: 90, align: 'right',
        render: (line) => (
            isLinesEditable ? (
                <input
                    className="input text-right w-full h-8 text-sm"
                    type="number"
                    min="0"
                    step="1"
                    defaultValue={line.quantity}
                    key={`qty-${line.purchaseOrderLineId}-${line.quantity}`}
                    onBlur={(e) => {
                        if (e.target.value !== line.quantity) {
                            updateLine(line.purchaseOrderLineId, 'quantity', e.target.value);
                        }
                    }}
                />
            ) : <span className="text-sm tabular-nums">{line.quantity}</span>
        ),
        mobileCard: (line, defaultRender) => <MobileCardField label={tPurchase('columns.qty')} value={
            isLinesEditable ? defaultRender : <span className="text-sm">{line.quantity} {line.unitOfMeasure || line.baseUom || tCommon('ea')}</span>
        } />
    },
    {
        id: 'received',
        header: tPurchase('columns.received'), width: 90, align: 'right',
        render: (line) => (
            <span className={`text-sm tabular-nums ${parseFloat(line.quantityReceived || '0') > 0 ? 'text-[var(--badge-shipped)] font-semibold' : 'font-normal'}`}>
                {parseFloat(line.quantityReceived || '0')}
            </span>
        ),
        mobileCard: (line, defaultRender) => <MobileCardField label={tPurchase('columns.received')} value={defaultRender} />
    },
    {
        id: 'uom',
        header: tPurchase('columns.uom'), width: 80, align: 'right',
        render: (line) => {
            if (!isLinesEditable) return <span className="text-sm tabular-nums">{line.unitOfMeasure || line.baseUom || tCommon('ea')}</span>;
            const uoms: ProductUom[] = line.productUoms || [];
            const defaultUom = line.baseUom || tCommon('ea');
            const selectOptions = uoms.length > 0 ? uoms : [{ uomCode: defaultUom, ratio: 1 }];
            return (
                <select
                    className="input w-full h-8 text-sm text-right"
                    value={line.unitOfMeasure || defaultUom}
                    onChange={(e) => {
                        const newVal = e.target.value;
                        const oldVal = line.unitOfMeasure || defaultUom;
                        if (newVal !== oldVal) {
                            const oldO = selectOptions.find(o => o.uomCode === oldVal);
                            const oldRatio = typeof oldO?.ratio === 'string' ? parseFloat(oldO.ratio) : (oldO?.ratio || 1);
                            const newO = selectOptions.find(o => o.uomCode === newVal);
                            const newRatio = typeof newO?.ratio === 'string' ? parseFloat(newO.ratio) : (newO?.ratio || 1);
                            const newPrice = calculateUomPriceAdjustment(line.pricePerUnit || 0, oldRatio, newRatio);
                            updateLineFields(line.purchaseOrderLineId, {
                                unitOfMeasure: newVal,
                                pricePerUnit: isNaN(newPrice) ? '0.00' : newPrice.toFixed(2)
                            });
                        }
                    }}
                >
                    {selectOptions.map(o => (
                        <option key={o.uomCode} value={o.uomCode}>{o.uomCode}</option>
                    ))}
                </select>
            );
        },
        mobileCard: () => null
    },
    {
        id: 'unitPrice',
        header: tPurchase('columns.unitPrice'), width: 110, align: 'right',
        render: (line) => (
            isLinesEditable ? (
                <input
                    className="input text-right w-full h-8 text-sm tabular-nums"
                    type="number"
                    min="0"
                    step="0.01"
                    defaultValue={parseFloat(line.pricePerUnit || '0').toFixed(2)}
                    key={`price-${line.purchaseOrderLineId}-${line.pricePerUnit}`}
                    onBlur={(e) => {
                        const val = parseFloat(e.target.value);
                        const formatted = isNaN(val) ? '0.00' : val.toFixed(2);
                        e.target.value = formatted;
                        if (formatted !== parseFloat(line.pricePerUnit || '0').toFixed(2)) {
                            updateLine(line.purchaseOrderLineId, 'pricePerUnit', formatted);
                        }
                    }}
                />
            ) : <span className="text-sm tabular-nums">{formatAmount(parseFloat(line.pricePerUnit || '0'), order?.currencyCode || 'EUR')}</span>
        ),
        mobileCard: (line, defaultRender) => <MobileCardField label={tPurchase('columns.unitPrice')} value={defaultRender} />
    },
    {
        id: 'discountPct',
        header: tPurchase('columns.discountPct'), width: 80, align: 'right',
        render: (line) => (
            isLinesEditable ? (
                <input
                    className="input text-right w-full h-8 text-sm tabular-nums"
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    defaultValue={line.discountPercentage}
                    key={`disc-${line.purchaseOrderLineId}-${line.discountPercentage}`}
                    onBlur={(e) => {
                        if (e.target.value !== line.discountPercentage) {
                            updateLine(line.purchaseOrderLineId, 'discountPercentage', e.target.value);
                        }
                    }}
                />
            ) : <span className="text-sm tabular-nums">{parseFloat(line.discountPercentage || '0').toFixed(1)}%</span>
        ),
        mobileCard: (line, defaultRender) => (
            isLinesEditable ? (
                <MobileCardField label={tPurchase('columns.discountPct')} value={defaultRender} />
            ) : null
        )
    },
    {
        id: 'tax',
        header: tPurchase('columns.tax'), width: 110, align: 'right',
        render: (line) => (
            isLinesEditable ? (
                <select
                    className="input w-full h-8 text-sm text-right"
                    value={line.taxCategoryId || ''}
                    onChange={(e) => updateLine(line.purchaseOrderLineId, 'taxCategoryId', e.target.value)}
                >
                    {taxCategories.map((c) => (
                        <option key={c.taxCategoryId} value={c.taxCategoryId}>
                            <TaxLabel category={c} />
                        </option>
                    ))}
                </select>
            ) : (
                <span className="text-sm tabular-nums text-right block">
                    {(() => {
                        const c = taxCategories.find((cat) => cat.taxCategoryId === line.taxCategoryId);
                        if (c) {
                            const pct = parseFloat(c.rate || '0');
                            const formattedPct = pct % 1 === 0 ? pct.toFixed(0) : pct.toString();
                            return <span title={`Tax Category: ${c.title}`} className="cursor-help border-b border-dotted border-[var(--text-muted)]">{formattedPct}%</span>;
                        }
                        const amt = parseFloat(line.amount || '0');
                        const tax = parseFloat(line.tax || '0');
                        if (amt > 0 && tax > 0) {
                            const pct = (tax / amt) * 100;
                            return <span title="Tax Category: Custom" className="cursor-help border-b border-dotted border-[var(--text-muted)]">{`${pct % 1 === 0 ? pct.toFixed(0) : pct.toFixed(1)}%`}</span>;
                        }
                        if (amt > 0 && tax === 0) return <span title={tCommon('taxLabels.exempt')} className="cursor-help border-b border-dotted border-[var(--text-muted)]">0%</span>;
                        return '—';
                    })()}
                </span>
            )
        ),
        mobileCard: (line, defaultRender) => <MobileCardField label={tPurchase('columns.tax')} value={defaultRender} />
    },
    {
        id: 'amount',
        header: tPurchase('columns.amount'), width: 110, align: 'right',
        render: (line) => (
            <span className="font-semibold tabular-nums text-sm">
                {formatAmount(parseFloat(line.amount || '0'), order?.currencyCode || 'EUR')}
            </span>
        ),
        mobileCard: (line, defaultRender) => <MobileCardField label={tPurchase('columns.amount')} value={
            <span className="font-bold text-[var(--accent)] text-base">{formatAmount(parseFloat(line.amount || '0'), order?.currencyCode || 'EUR')}</span>
        } />
    },
    ...(isLinesEditable ? [{
        id: 'actions',
        header: '', width: 50, align: 'right' as const,
        render: (line: OrderLine) => (
            <Button
                variant="danger" size="sm"
                onClick={() => removeLine(line.purchaseOrderLineId)}
                title="Remove line"
            >
                <span dangerouslySetInnerHTML={{ __html: '&#10005;' }} />
            </Button>
        ),
        mobileCard: (line: OrderLine) => (
            <div className="flex justify-end mt-2">
                <Button
                    variant="danger" size="sm"
                    onClick={() => removeLine(line.purchaseOrderLineId)}
                >
                    <span dangerouslySetInnerHTML={{ __html: '&#10005;' }} /> {tCommon('buttons.remove')}
                </Button>
            </div>
        )
    }] : [])
  ], [tPurchase, isLinesEditable, order?.currencyCode, taxCategories, updateLine, removeLine, updateLineFields, tCommon]);

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
                  </>
                ) : undefined
              }
            />
          </div>

          {activeTab === 'lines' ? (
            <DataTable
              data={order.lines}
              keyExtractor={(line) => line.purchaseOrderLineId}
              columns={lineColumns}
              mobileCard={(line: OrderLine) => {
                const isAmountCol = (colHeader: React.ReactNode) => colHeader === tPurchase('columns.amount');
                const actionCol = lineColumns.find(c => c.id === 'actions')?.render?.(line, 0);
                return (
                  <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] p-4 flex flex-col">
                    <div className="flex justify-between items-start gap-2 mb-2">
                      <div className="font-semibold text-sm text-[var(--accent)]">
                        {lineColumns.find(c => c.id === 'product')?.render?.(line, 0)}
                      </div>
                      <div className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded font-medium">{line.lineNumber}</div>
                    </div>
                    <div className="text-sm text-slate-600 font-medium mb-3 [&_.input]:w-full [&_.input]:text-sm [&_.input]:h-8 [&_.input]:!py-1">
                      {lineColumns.find(c => c.id === 'description')?.render?.(line, 0)}
                    </div>
                    <div className="flex flex-col gap-0 border-t border-slate-100 pt-1">
                      {lineColumns.filter(c => ['qty', 'received', 'uom', 'unitPrice', 'discountPct', 'tax', 'amount'].includes(c.id!)).map(col => (
                        <MobileCardField
                          key={col.id}
                          label={col.header}
                          value={
                            <div className={isAmountCol(col.header) ? 'font-bold text-[var(--accent)] text-base' : '[&_.input]:text-sm [&_.input]:h-8 [&_.input]:!py-1 [&_.input]:w-24 [&_select.input]:w-32'}>
                              {col.render?.(line, 0)}
                            </div>
                          }
                        />
                      ))}
                      {actionCol && (
                        <div className="flex justify-end mt-2">
                          {actionCol}
                        </div>
                      )}
                    </div>
                  </div>
                );
              }}
              emptyMessage={tPurchase('noLineItems')}
              footer={
                order.lines.length > 0 ? (() => {
                  const taxPct = subtotal > 0 ? (totalTax / subtotal) * 100 : 0;
                  return (
                    <>
                      <tr className="hidden lg:table-row border-t-2 border-[var(--border)]">
                        <td colSpan={9} className="text-right font-semibold text-[var(--text-muted)]">
                          {tCommon('subtotal')}
                        </td>
                        <td className="text-right font-semibold tabular-nums">
                          {formatAmount(subtotal, order.currencyCode || 'EUR')}
                        </td>
                        {isLinesEditable && <td></td>}
                      </tr>
                      <tr className="hidden lg:table-row">
                        <td colSpan={9} className="text-right font-semibold text-[var(--text-muted)]">
                          {tCommon('tax')}{taxPct > 0 ? ` (${taxPct % 1 === 0 ? taxPct.toFixed(0) : taxPct.toFixed(1)}%)` : ''}
                        </td>
                        <td className="text-right font-semibold tabular-nums">
                          {formatAmount(totalTax, order.currencyCode || 'EUR')}
                        </td>
                        {isLinesEditable && <td></td>}
                      </tr>
                      <tr className="hidden lg:table-row bg-blue-500/[0.02]">
                        <td colSpan={9} className="text-right font-bold text-[13px] text-[var(--text-primary)]">
                          {tCommon('total')}
                        </td>
                        <td className="text-right font-extrabold text-sm text-[var(--accent)] tabular-nums">
                          {formatAmount(subtotal + totalTax, order.currencyCode || 'EUR')}
                        </td>
                        {isLinesEditable && <td></td>}
                      </tr>
                      
                      {/* Mobile summary */}
                      <tr className="lg:hidden">
                          <td className="py-1 text-xs font-medium text-slate-500 text-right pr-4">{tCommon('subtotal')}</td>
                          <td className="py-1 text-sm font-semibold text-right tabular-nums">{formatAmount(subtotal, order.currencyCode || 'EUR')}</td>
                      </tr>
                      <tr className="lg:hidden">
                          <td className="py-1 text-xs font-medium text-slate-500 text-right pr-4">{tCommon('tax')}</td>
                          <td className="py-1 text-sm font-semibold text-right tabular-nums">{formatAmount(totalTax, order.currencyCode || 'EUR')}</td>
                      </tr>
                      <tr className="lg:hidden">
                          <td className="py-2 text-sm font-bold text-[var(--accent)] text-right pr-4">{tCommon('total')}</td>
                          <td className="py-2 text-base font-bold text-[var(--accent)] text-right tabular-nums">{formatAmount(subtotal + totalTax, order.currencyCode || 'EUR')}</td>
                      </tr>
                    </>
                  );
                })() : null
              }
            />
          ) : activeTab === 'availability' ? (
            /* Availability tab */
            inventoryLoading ? (
              <p className="text-sm text-[var(--text-muted)] py-5 text-center">{tPurchase('loadingInventory')}</p>
            ) : (
              <DataTable
                data={(order.lines || []).filter((line) => parseFloat(line.quantity || '0') > 0)}
                keyExtractor={(line) => line.purchaseOrderLineId}
                columns={[
                  { header: tPurchase('columns.lineNumber'), width: 40 },
                  { header: tPurchase('columns.product') },
                  { header: tPurchase('columns.description') },
                  { header: tPurchase('columns.thisOrder'), width: 90, align: 'right' },
                  { header: tPurchase('columns.location'), width: 100, align: 'right' },
                  { header: tPurchase('columns.onHand'), width: 90, align: 'right' },
                  { header: tPurchase('columns.committed'), width: 90, align: 'right' },
                  { header: tPurchase('columns.ordered'), width: 90, align: 'right' },
                  { header: tPurchase('columns.reserved'), width: 90, align: 'right' },
                  { header: tPurchase('columns.available'), width: 90, align: 'right' },
                  { header: tPurchase('columns.status'), width: 70, align: 'center' }
                ]}
                emptyMessage={tPurchase('noLineItemsShort')}
                renderCustomRow={(line) => {
                    const lineInventory = inventoryData.filter(
                      (inv) => inv.productId === line.productId,
                    );
                    const totalAvail = lineInventory.reduce(
                      (sum, inv) => sum + calculateAvailableQuantity(inv.quantityOnHand, inv.quantityCommitted, inv.quantityReserved), 0,
                    );
                    const orderedQty = parseFloat(line.quantity || '0');
                    const canFulfil = totalAvail >= orderedQty;

                    if (lineInventory.length === 0) {
                      return (
                        <tr key={line.purchaseOrderLineId}>
                          <td className="text-[var(--text-muted)]">{line.lineNumber}</td>
                          <td className="font-semibold text-xs">
                            {line.productId && line.productId !== '00000000-0000-0000-0000-000000000000' ? (
                              <Link href={`/products/${line.productId}`} className="text-[var(--accent)] no-underline hover:underline">
                                {line.productNumber || line.productId?.substring(0, 8)}
                              </Link>
                            ) : (
                              line.productNumber || line.productId?.substring(0, 8) || '—'
                            )}
                          </td>
                          <td>{line.productDescription || '—'}</td>
                          <td className="text-right tabular-nums">{line.quantity}</td>
                          <td colSpan={6} className="text-center text-[var(--text-muted)] text-xs">
                            {tPurchase('noInventoryData')}
                          </td>
                          <td className="text-center">
                            <span className="text-amber-500 font-bold text-[11px]">⚠</span>
                          </td>
                        </tr>
                      );
                    }

                    return lineInventory.map((inv, idx) => {
                      const avail = calculateAvailableQuantity(inv.quantityOnHand, inv.quantityCommitted, inv.quantityReserved);
                      return (
                        <tr key={`${line.purchaseOrderLineId}-${inv.inventoryLevelId}`}>
                          {idx === 0 && (
                            <>
                              <td className="text-[var(--text-muted)]" rowSpan={lineInventory.length}>{line.lineNumber}</td>
                              <td className="font-semibold text-xs" rowSpan={lineInventory.length}>
                                {line.productId && line.productId !== '00000000-0000-0000-0000-000000000000' ? (
                                  <Link href={`/products/${line.productId}`} className="text-[var(--accent)] no-underline hover:underline">
                                    {line.productNumber || line.productId?.substring(0, 8)}
                                  </Link>
                                ) : (
                                  line.productNumber || line.productId?.substring(0, 8) || '—'
                                )}
                              </td>
                              <td rowSpan={lineInventory.length}>{line.productDescription || '—'}</td>
                              <td className="text-right tabular-nums" rowSpan={lineInventory.length}>
                                {line.quantity}
                              </td>
                            </>
                          )}
                          <td className="text-right text-xs">{inv.locationName || inv.locationNo}</td>
                          <td className="text-right tabular-nums">
                            {parseFloat(inv.quantityOnHand || '0')}
                          </td>
                          <td className="text-right tabular-nums">
                            {parseFloat(inv.quantityCommitted || '0')}
                          </td>
                          <td className="text-right tabular-nums">
                            {parseFloat(inv.quantityOnOrder || '0')}
                          </td>
                          <td className="text-right tabular-nums">
                            {parseFloat(inv.quantityReserved || '0')}
                          </td>
                          <td className={`text-right tabular-nums font-semibold ${avail > 0 ? 'text-green-400' : 'text-red-500'}`}>
                            {avail}
                          </td>
                          {idx === 0 && (
                            <td className="text-center" rowSpan={lineInventory.length}>
                              <span className={`font-bold text-[11px] ${canFulfil ? 'text-green-400' : 'text-red-500'}`}>
                                {canFulfil ? '✓' : '✗'}
                              </span>
                            </td>
                          )}
                        </tr>
                      );
                    });
                }}
                mobileCard={(line) => {
                    const lineInventory = inventoryData.filter(
                      (inv) => inv.productId === line.productId,
                    );
                    const totalAvail = lineInventory.reduce(
                      (sum, inv) => sum + calculateAvailableQuantity(inv.quantityOnHand, inv.quantityCommitted, inv.quantityReserved), 0,
                    );
                    const orderedQty = parseFloat(line.quantity || '0');
                    const canFulfil = totalAvail >= orderedQty;

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
                            
                            {lineInventory.length === 0 ? (
                                <div className="text-sm text-amber-600 italic text-center py-2 bg-amber-50 rounded border border-amber-100">{tPurchase('noInventoryData')} ⚠</div>
                            ) : (
                                <>
                                    <div className="flex justify-between items-center py-2 border-t border-slate-100">
                                        <span className="text-xs font-medium text-slate-500">{tPurchase('columns.thisOrder')}</span>
                                        <span className="text-sm font-semibold">{line.quantity}</span>
                                    </div>
                                    
                                    <div className="mt-3 flex flex-col gap-2">
                                        <span className="text-xs font-medium text-slate-500">{tPurchase('columns.location')}:</span>
                                        {lineInventory.map((inv) => {
                                            const avail = calculateAvailableQuantity(inv.quantityOnHand, inv.quantityCommitted, inv.quantityReserved);
                                            return (
                                                <div key={inv.inventoryLevelId} className="bg-slate-50 rounded p-2 text-xs flex flex-col gap-1 border border-slate-100">
                                                    <div className="flex justify-between font-medium">
                                                        <span>{inv.locationName || inv.locationNo}</span>
                                                        <span className={avail > 0 ? 'text-emerald-600' : 'text-rose-600'}>{avail} {tPurchase('availabilityTab.avail')}</span>
                                                    </div>
                                                    <div className="flex justify-between text-slate-500">
                                                        <span>{parseFloat(inv.quantityOnHand || '0')} {tPurchase('availabilityTab.onHand')}</span>
                                                        <span>{parseFloat(inv.quantityCommitted || '0')} {tPurchase('availabilityTab.cmt')} / {parseFloat(inv.quantityOnOrder || '0')} {tPurchase('availabilityTab.in')}</span>
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
            )
          ) : activeTab === 'status' ? (
            /* Status / Bill Summary tab */
            <div className="overflow-x-auto">
              <DataTable
                  data={(order.lines || []).filter((line) => parseFloat(line.quantity || '0') > 0)}
                  keyExtractor={(line) => line.purchaseOrderLineId}
                  columns={[
                      { header: tPurchase('columns.lineNumber'), width: 40 },
                      { header: tPurchase('columns.product') },
                      { header: tPurchase('columns.description') },
                      { header: tPurchase('columns.ordered'), align: 'right' },
                      { header: tPurchase('allocated'), align: 'right' },
                      { header: tPurchase('columns.received'), align: 'right' },
                      { header: tPurchase('columns.billed'), align: 'right' },
                      { header: tPurchase('columns.remaining'), align: 'right' }
                  ]}
                  emptyMessage={tPurchase('noLineItemsShort')}
                  renderCustomRow={(line) => {
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
                              <td className="text-[var(--text-muted)]">{line.lineNumber}</td>
                              <td className="font-semibold text-xs">
                                  {line.productNumber || line.productId?.substring(0, 8) || '—'}
                              </td>
                              <td>{line.productDescription || '—'}</td>
                              <td className="text-right tabular-nums">{ordered}</td>
                              <td className={`text-right tabular-nums ${allocated > 0 ? 'text-[var(--badge-shipped)] font-semibold' : 'font-normal'}`}>{allocated}</td>
                              <td className={`text-right tabular-nums ${received >= ordered && ordered > 0 ? 'text-[var(--badge-shipped)] font-semibold' : 'font-normal'}`}>{received}</td>
                              <td className={`text-right tabular-nums ${billed >= received && received > 0 ? 'text-[var(--badge-shipped)] font-semibold' : 'font-normal'}`}>{billed}</td>
                              <td className={`text-right tabular-nums ${remaining === 0 ? 'text-[var(--text-muted)]' : ''}`}>{remaining}</td>
                          </tr>
                      );
                  }}
                  mobileCard={(line) => {
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
                                      <span className={received >= ordered && ordered > 0 ? 'font-semibold text-emerald-600' : ''}>{received}</span>
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
        </div>

    </>
  );
}

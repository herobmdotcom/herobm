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
import { DataTable, MobileCardField, DataTableColumn } from '@/components/shared/DataTable';

import type { OrderLine, TaxCategory } from './types';
import type { PurchaseInvoiceLine } from '@/lib/purchase-order-utils';
import { getTaxLabel } from './types';
import InvoicesSection from './InvoicesSection';
import AllocationsSection from './AllocationsSection';
import ReceptionsSection from './ReceptionsSection';
import ReturnsSection from './ReturnsSection';
import { usePurchaseOrder } from './usePurchaseOrder';

import StateBadge from '@/components/StateBadge';
import { ValidState } from '@/types/states';

function TaxLabel({ category }: { category: TaxCategory }) {
  if (!category) return null;
  return <>{getTaxLabel(category)}</>;
}

interface CustomLineColumn extends DataTableColumn<OrderLine> {
  mobileCard?: (line: OrderLine, defaultRender?: React.ReactNode) => React.ReactNode;
}

export default function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const tCommon = useTranslations('common');
  const tPurchase = useTranslations('purchaseOrders');
  const tToast = useTranslations('toast');

  const o = usePurchaseOrder(id);


  const { order, loading, error, saving, copying, latestAutoTransition,
    isHeaderEditable, isLinesEditable, visibleTransitions, subtotal, totalTax,
    editName, setEditName, editReferenceNumber, setEditReferenceNumber,
    editExpectedDate, setEditExpectedDate,
    editNotes, setEditNotes, editLocationId, setEditLocationId, headerDirty,
    taxCategories, activeTab, setActiveTab, inventoryData, inventoryLoading,
    invoices, setInvoicing,
    clearError, setError, saveHeader, changeState, copyOrder,
    updateLine, updateLineFields, removeLine, addLineFromProduct, addBlankLine,
    loadOrder, loadInvoices, loadAllocations, allocations, allocationsLoading,
  } = o;

  useDocumentTitle(order ? (order.name ? `${order.orderNumber} - ${order.name}` : order.orderNumber) : null);



  const sections = {
    details: { id: 'details-section', label: 'Details', show: true },
    allocations: { id: 'allocations-section', label: 'Allocations', show: true },
    receptions: { id: 'receptions-section', label: 'Receptions', show: true },
    invoices: { id: 'Invoices-section', label: 'Invoices', show: true },
    activity: { id: 'activity-section', label: 'Activity', show: true },
  };
  const visibleSections = Object.values(sections).filter(s => s.show);

  const lineColumns: CustomLineColumn[] = useMemo(() => [
    {
        header: tPurchase('columns.lineNumber'), width: 40,
        render: (line) => <span className="text-slate-500 font-medium">#{line.lineNumber}</span>,
        mobileCard: () => null
    },
    {
        header: tPurchase('columns.product'),
        render: (line) => (
            <div className="font-semibold text-sm">
                {line.productId && line.productId !== '00000000-0000-0000-0000-000000000000' ? (
                    <Link href={`/products/${line.productId}`} style={{ color: 'var(--accent)', textDecoration: 'none' }}>
                        {line.productNumber || line.productId?.substring(0, 8)}
                    </Link>
                ) : (
                    line.productNumber || line.productId?.substring(0, 8) || '—'
                )}
            </div>
        )
    },
    {
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
                            return <span title={`Tax Category: ${c.title}`} style={{ cursor: 'help', borderBottom: '1px dotted var(--text-muted)' }}>{formattedPct}%</span>;
                        }
                        const amt = parseFloat(line.amount || '0');
                        const tax = parseFloat(line.tax || '0');
                        if (amt > 0 && tax > 0) {
                            const pct = (tax / amt) * 100;
                            return <span title="Tax Category: Custom" style={{ cursor: 'help', borderBottom: '1px dotted var(--text-muted)' }}>{`${pct % 1 === 0 ? pct.toFixed(0) : pct.toFixed(1)}%`}</span>;
                        }
                        if (amt > 0 && tax === 0) return <span title={tCommon('taxLabels.exempt')} style={{ cursor: 'help', borderBottom: '1px dotted var(--text-muted)' }}>0%</span>;
                        return '—';
                    })()}
                </span>
            )
        ),
        mobileCard: (line, defaultRender) => <MobileCardField label={tPurchase('columns.tax')} value={defaultRender} />
    },
    {
        header: tPurchase('columns.amount'), width: 110, align: 'right',
        render: (line) => (
            <span className="font-bold tabular-nums">
                {formatAmount(parseFloat(line.amount || '0'), order?.currencyCode || 'EUR')}
            </span>
        ),
        mobileCard: (line, defaultRender) => <MobileCardField label={tPurchase('columns.amount')} value={
            <span className="font-bold text-[var(--accent)] text-base">{formatAmount(parseFloat(line.amount || '0'), order?.currencyCode || 'EUR')}</span>
        } />
    },
    ...(isLinesEditable ? [{
        header: '', width: 50,
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

  if (loading) {
    return (
      <>
        <div className="flex items-center justify-center flex-1">
          <p style={{ color: 'var(--text-muted)' }}>{tCommon('loading')}</p>
        </div>
      </>
    );
  }

  if (!order) {
    return (
      <>
        <div className="flex flex-col items-center justify-center flex-1">
          <p className="text-lg mb-2" style={{ color: 'var(--danger)' }}>
            {error || tPurchase('orderNotFound')}
          </p>
          <Button variant="secondary" onClick={() => router.push('/purchase-orders')}>
            {tPurchase('backToOrders')}
          </Button>
        </div>
      </>
    );
  }

  return (
    <>
      <DetailsLayout
        header={
          <EntityHeader
            title={order.orderNumber}
            subtitle={order.name === order.orderNumber ? null : (order.name || tPurchase('untitledOrder'))}
            isSaving={saving}
            badges={<StateBadge state={order.stateCode as ValidState} />}
            nav={<PageNav sections={visibleSections} />}
            actions={
              <>

                {visibleTransitions.map((t) => (
                  <Button
                    key={t.state}
                    variant={t.isDanger ? 'danger' : t.isBack ? 'secondary' : 'primary'}
                    size="sm"
                    onClick={() => changeState(t.state)}
                  >
                    {t.icon === 'close' ? (
                      <>
                        {/* eslint-disable-next-line i18next/no-literal-string -- Hardcoded string exceptions for standard system IDs, technical constants, or non-translatable symbols (e.g., -- Material UI Icon). */}
                        <span className="material-symbols-outlined mr-1" style={{ fontSize: 16 }}>close</span>
                      </>
                    ) : (
                      t.icon
                    )}
                    {t.label}
                  </Button>
                ))}
              </>
            }
          />
        }
      >
      <div className="flex flex-col gap-3">

      {error && (
        <div
          className="px-4 py-3 rounded-lg text-sm"
          style={{
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            color: '#f87171',
          }}
        >
          {error}
          <Button variant="ghost" className="ml-3 text-xs underline" onClick={clearError}>{tCommon('dismiss')}</Button>
        </div>
      )}

          {/* Order info card */}
          <div id="details-section" className="card">
            <div className="flex justify-between items-center mb-4">
              <h3 className="section-heading">
                { }
                <span className="material-symbols-outlined">receipt_long</span>
                {tPurchase('orderDetails')}
              </h3>
              <Button
                variant="secondary"
                size="sm"
                onClick={copyOrder}
                disabled={copying}
              >
                {copying ? tCommon('copying') : tPurchase('buttons.copyOrder')}
              </Button>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                    {tPurchase('labels.supplier')}
                    {order.currencyCode && (
                      <span
                        style={{
                          marginLeft: 8,
                          padding: '1px 6px',
                          borderRadius: 4,
                          background: 'rgba(59,130,246,0.15)',
                          color: 'var(--accent)',
                          fontWeight: 600,
                          fontSize: 10,
                          letterSpacing: '0.04em',
                        }}
                      >
                        {order.currencyCode}
                      </span>
                    )}
                  </label>
                  <div className="text-sm" style={{ fontWeight: 500, paddingTop: 6 }}>
                    {order.vendorId ? (
                      <Link href={`/suppliers/${order.vendorId}`} className="text-[var(--accent)] hover:underline">
                        {order.vendorName || order.vendorId}
                      </Link>
                    ) : (
                      order.vendorName || '—'
                    )}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                    {tPurchase('labels.referenceNumber')}
                  </label>
                  <input
                    className="input"
                    value={editReferenceNumber}
                    onChange={(e) => setEditReferenceNumber(e.target.value)}
                    onBlur={saveHeader}
                    disabled={!isHeaderEditable}
                    placeholder={tPurchase('placeholders.referenceNumber')}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                    {tPurchase('labels.expectedDate')}
                  </label>
                  {isHeaderEditable ? (
                    <input
                      type="date"
                      className="input"
                      value={editExpectedDate}
                      onChange={(e) => setEditExpectedDate(e.target.value)}
                      onBlur={saveHeader}
                      disabled={!isHeaderEditable}
                    />
                  ) : (
                    <p className="text-sm" style={{ fontWeight: 500, paddingTop: 6 }}>
                      {order.expectedDate ? new Date(order.expectedDate).toLocaleDateString() : '—'}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                    {tPurchase('labels.orderName')}
                  </label>
                  <input
                    className="input"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onBlur={saveHeader}
                    disabled={!isHeaderEditable}
                    placeholder={tPurchase('placeholders.orderName')}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                    {tPurchase('labels.created')}
                  </label>
                  <p className="text-sm" style={{ fontWeight: 500, paddingTop: 6 }}>
                    {new Date(order.createdOn).toLocaleString()} {tCommon('by')} {order.createdBy || '—'}
                  </p>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                    {tPurchase('labels.location')}
                  </label>
                  {isHeaderEditable && order.stateCode === PURCHASE_ORDER_STATE.DRAFT ? (
                    <LocationSelect
                      value={editLocationId || ''}
                      onChange={(loc) => setEditLocationId(loc)}
                      className="text-sm"
                    />
                  ) : (
                    <p className="text-sm" style={{ fontWeight: 500, paddingTop: 6 }}>
                      {order.locationName || order.deliveryLocationId || '—'}
                    </p>
                  )}
                </div>
                <div className="hidden lg:block">
                   {/* notes pushed to full width if needed, or matched next column */}
                </div>
                <div className="lg:col-span-2">
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                    {tCommon('notesCardHeading')}
                  </label>
                  <input
                    className="input w-full"
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    onBlur={saveHeader}
                    disabled={!isHeaderEditable}
                    placeholder={tCommon('notesCardPlaceholder')}
                  />
                </div>
              </div>
          </div>

        {/* Line items / Availability tabs */}
        <div id="lines-section" className="card">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-4">
            <div className="flex overflow-x-auto w-full lg:w-auto pb-1 lg:pb-0">
              <div className="flex gap-0 min-w-max">
                <Button variant="ghost"
                className="text-xs font-medium px-3 py-1.5 rounded-l-lg"
                style={{
                  color: activeTab === 'lines' ? 'var(--accent)' : 'var(--text-muted)',
                  background: activeTab === 'lines' ? 'rgba(59,130,246,0.1)' : 'transparent',
                  border: '1px solid',
                  borderColor: activeTab === 'lines' ? 'rgba(59,130,246,0.3)' : 'var(--border)',
                  cursor: 'pointer',
                }}
                onClick={() => setActiveTab('lines')}
              >
                {tPurchase('lineItems')}
              </Button>
              <Button variant="ghost"
                className={`text-xs font-medium px-3 py-1.5 ${order.stateCode !== PURCHASE_ORDER_STATE.DRAFT ? '' : 'rounded-r-lg'}`}
                style={{
                  color: activeTab === 'availability' ? 'var(--accent)' : 'var(--text-muted)',
                  background: activeTab === 'availability' ? 'rgba(59,130,246,0.1)' : 'transparent',
                  border: '1px solid',
                  borderColor: activeTab === 'availability' ? 'rgba(59,130,246,0.3)' : 'var(--border)',
                  borderLeft: activeTab === 'availability' ? '1px solid rgba(59,130,246,0.3)' : 'none',
                  cursor: 'pointer',
                }}
                onClick={() => setActiveTab('availability')}
              >
                {tPurchase('availability')}
              </Button>
              {order.stateCode !== PURCHASE_ORDER_STATE.DRAFT && (
                <Button variant="ghost"
                  className="text-xs font-medium px-3 py-1.5 rounded-r-lg"
                  style={{
                    color: activeTab === 'status' ? 'var(--accent)' : 'var(--text-muted)',
                    background: activeTab === 'status' ? 'rgba(59,130,246,0.1)' : 'transparent',
                    border: '1px solid',
                    borderColor: activeTab === 'status' ? 'rgba(59,130,246,0.3)' : 'var(--border)',
                    borderLeft: activeTab === 'status' ? '1px solid rgba(59,130,246,0.3)' : 'none',
                    cursor: 'pointer',
                  }}
                  onClick={() => setActiveTab('status')}
                >
                  {tPurchase('statusTab')}
                </Button>
              )}
              </div>
            </div>
            {isLinesEditable && activeTab === 'lines' && (
              <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto justify-start lg:justify-end">
                <div className="flex-1 min-w-[200px] max-w-sm">
                  <ProductSearchInput
                    onSelect={addLineFromProduct}
                    placeholder="Add product… (search)"
                    style={{ width: '100%' }}
                  />
                </div>
                <Button
                  variant="secondary" size="sm" className="whitespace-nowrap"
                  onClick={addBlankLine}
                  disabled={saving}
                >
                  {tPurchase('buttons.customLine')}
                </Button>
              </div>
            )}
          </div>

          {activeTab === 'lines' ? (
            <DataTable
              data={order.lines}
              keyExtractor={(line) => line.purchaseOrderLineId}
              columns={lineColumns}
              mobileCard={(line: OrderLine) => {
                const isAmountCol = (colHeader: React.ReactNode) => colHeader === tPurchase('columns.amount');
                const actionCol = lineColumns.length > 9 ? lineColumns[9].render?.(line, 0) : null;
                return (
                  <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] p-4 flex flex-col">
                    <div className="flex justify-between items-start gap-2 mb-2">
                      <div className="font-semibold text-sm text-[var(--accent)]">
                        {lineColumns[1].render?.(line, 0)}
                      </div>
                      <div className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded font-medium">#{line.lineNumber}</div>
                    </div>
                    <div className="text-sm text-slate-600 font-medium mb-3 [&_.input]:w-full [&_.input]:text-sm [&_.input]:h-8 [&_.input]:!py-1">
                      {lineColumns[2].render?.(line, 0)}
                    </div>
                    <div className="flex flex-col gap-0 border-t border-slate-100 pt-1">
                      {[3, 4, 5, 6, 7, 8].map(colIdx => {
                        const col = lineColumns[colIdx];
                        return (
                          <MobileCardField
                            key={colIdx}
                            label={col.header}
                            value={
                              <div className={isAmountCol(col.header) ? 'font-bold text-[var(--accent)] text-base' : '[&_.input]:text-sm [&_.input]:h-8 [&_.input]:!py-1 [&_.input]:w-24 [&_select.input]:w-32'}>
                                {col.render?.(line, 0)}
                              </div>
                            }
                          />
                        );
                      })}
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
                      <tr className="hidden lg:table-row" style={{ borderTop: '2px solid var(--border)' }}>
                        <td colSpan={8} style={{ textAlign: 'right', fontWeight: 600, color: 'var(--text-muted)' }}>
                          {tCommon('subtotal')}
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                          {formatAmount(subtotal, order.currencyCode || 'EUR')}
                        </td>
                        {isLinesEditable && <td></td>}
                      </tr>
                      <tr className="hidden lg:table-row">
                        <td colSpan={8} style={{ textAlign: 'right', fontWeight: 600, color: 'var(--text-muted)' }}>
                          {tCommon('tax')}{taxPct > 0 ? ` (${taxPct % 1 === 0 ? taxPct.toFixed(0) : taxPct.toFixed(1)}%)` : ''}
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                          {formatAmount(totalTax, order.currencyCode || 'EUR')}
                        </td>
                        {isLinesEditable && <td></td>}
                      </tr>
                      <tr className="hidden lg:table-row" style={{ backgroundColor: 'rgba(59,130,246,0.02)' }}>
                        <td colSpan={8} style={{ textAlign: 'right', fontWeight: 700, fontSize: 13, color: 'var(--text-primary)' }}>
                          {tCommon('total')}
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 800, fontSize: 14, color: 'var(--accent)', fontVariantNumeric: 'tabular-nums' }}>
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
              <p className="text-sm" style={{ color: 'var(--text-muted)', padding: '20px 0', textAlign: 'center' }}>{tPurchase('loadingInventory')}</p>
            ) : (
              <DataTable
                data={order.lines}
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
                          <td style={{ color: 'var(--text-muted)' }}>{line.lineNumber}</td>
                          <td style={{ fontWeight: 600, fontSize: 12 }}>
                            {line.productId && line.productId !== '00000000-0000-0000-0000-000000000000' ? (
                              <Link href={`/products/${line.productId}`} style={{ color: 'var(--accent)', textDecoration: 'none' }}>
                                {line.productNumber || line.productId?.substring(0, 8)}
                              </Link>
                            ) : (
                              line.productNumber || line.productId?.substring(0, 8) || '—'
                            )}
                          </td>
                          <td>{line.productDescription || '—'}</td>
                          <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{line.quantity}</td>
                          <td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
                            {tPurchase('noInventoryData')}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <span style={{ color: '#f59e0b', fontWeight: 700, fontSize: 11 }}>⚠</span>
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
                              <td style={{ color: 'var(--text-muted)' }} rowSpan={lineInventory.length}>{line.lineNumber}</td>
                              <td style={{ fontWeight: 600, fontSize: 12 }} rowSpan={lineInventory.length}>
                                {line.productId && line.productId !== '00000000-0000-0000-0000-000000000000' ? (
                                  <Link href={`/products/${line.productId}`} style={{ color: 'var(--accent)', textDecoration: 'none' }}>
                                    {line.productNumber || line.productId?.substring(0, 8)}
                                  </Link>
                                ) : (
                                  line.productNumber || line.productId?.substring(0, 8) || '—'
                                )}
                              </td>
                              <td rowSpan={lineInventory.length}>{line.productDescription || '—'}</td>
                              <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }} rowSpan={lineInventory.length}>
                                {line.quantity}
                              </td>
                            </>
                          )}
                          <td style={{ textAlign: 'right', fontSize: 12 }}>{inv.locationName || inv.locationNo}</td>
                          <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                            {parseFloat(inv.quantityOnHand || '0')}
                          </td>
                          <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                            {parseFloat(inv.quantityCommitted || '0')}
                          </td>
                          <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                            {parseFloat(inv.quantityOnOrder || '0')}
                          </td>
                          <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                            {parseFloat(inv.quantityReserved || '0')}
                          </td>
                          <td style={{
                            textAlign: 'right',
                            fontVariantNumeric: 'tabular-nums',
                            fontWeight: 600,
                            color: avail > 0 ? '#4ade80' : '#ef4444',
                          }}>
                            {avail}
                          </td>
                          {idx === 0 && (
                            <td style={{ textAlign: 'center' }} rowSpan={lineInventory.length}>
                              <span style={{
                                color: canFulfil ? '#4ade80' : '#ef4444',
                                fontWeight: 700,
                                fontSize: 11,
                              }}>
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
                                <div className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded font-medium">#{line.lineNumber}</div>
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
                  data={order.lines || []}
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
                              <td style={{ color: 'var(--text-muted)' }}>{line.lineNumber}</td>
                              <td style={{ fontWeight: 600, fontSize: 12 }}>
                                  {line.productNumber || line.productId?.substring(0, 8) || '—'}
                              </td>
                              <td>{line.productDescription || '—'}</td>
                              <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{ordered}</td>
                              <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: allocated > 0 ? 'var(--badge-shipped)' : undefined, fontWeight: allocated > 0 ? 600 : 400 }}>{allocated}</td>
                              <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: received >= ordered && ordered > 0 ? 'var(--badge-shipped)' : undefined, fontWeight: received >= ordered && ordered > 0 ? 600 : 400 }}>{received}</td>
                              <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: billed >= received && received > 0 ? 'var(--badge-shipped)' : undefined, fontWeight: billed >= received && received > 0 ? 600 : 400 }}>{billed}</td>
                              <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: remaining === 0 ? 'var(--text-muted)' : undefined }}>{remaining}</td>
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
                                  <div className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded font-medium">#{line.lineNumber}</div>
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

        <AllocationsSection 
          orderId={id} 
          allocations={allocations} 
          loading={allocationsLoading} 
          onAllocationsChanged={loadAllocations} 
        />

        <ReceptionsSection orderId={id} />

        <ReturnsSection
          orderId={id}
          orderState={order.stateCode}
          orderLines={order.lines}
          events={order.events}
          currencyCode={order.currencyCode}
        />

        <InvoicesSection
          orderId={id}
          order={order}
          Invoices={invoices}
          taxCategories={taxCategories}
          setError={setError}
          loadInvoices={loadInvoices}
          loadOrder={loadOrder}
        />

        {/* Audit timeline */}
        <div id="activity-section" className="card">
          <ActivityTimeline events={order.events || []} />
        </div>
      </div>
      </DetailsLayout>

      {/* Global Toast Notification for Auto-Transitions */}
      <div
        className={`fixed bottom-6 right-6 rounded-lg p-4 max-w-[400px] z-[60] flex flex-col gap-1 pointer-events-none border border-[var(--border)] transition-all duration-300 ease-out ${latestAutoTransition ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0'
 }`}
        style={{ background: 'var(--bg-card)' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 16 }}>⚡</span>
          <strong style={{ fontSize: 13, color: 'var(--text-primary)' }}>
            {tToast('orderStateUpdated')}
          </strong>
        </div>
        <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.4 }}>
          {latestAutoTransition && (
            tToast('orderMovedToReason', {
              state: tCommon(`states.${latestAutoTransition.to}` as never),
              reason: latestAutoTransition.reason.toLowerCase()
            })
          )}
        </p>
      </div>
    </>
  );
}

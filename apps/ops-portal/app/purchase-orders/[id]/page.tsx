'use client';

import { use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { calculateAvailableQuantity, PURCHASE_ORDER_STATE } from '@modbm/shared';
import ProductSearchInput from '@/components/shared/ProductSearchInput';
import ActivityTimeline from '@/components/shared/ActivityTimeline';
import { formatAmount } from '@/lib/currency';
import { calculateUomPriceAdjustment } from '@modbm/shared';
import type { ProductUom } from '@modbm/shared';
import { useTranslations } from 'next-intl';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import EntityHeader from '@/components/shared/EntityHeader';
import DetailsLayout from '@/components/shared/DetailsLayout';
import PageNav from '@/components/shared/PageNav';
import LocationSelect from '@/components/shared/LocationSelect';

import type { TaxCategory } from './types';
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
    editNotes, setEditNotes, editLocationId, setEditLocationId, headerDirty,
    taxCategories, activeTab, setActiveTab, inventoryData, inventoryLoading,
    invoices, setInvoicing,
    clearError, setError, saveHeader, changeState, copyOrder,
    updateLine, updateLineFields, removeLine, addLineFromProduct, addBlankLine,
    loadOrder, loadInvoices, loadAllocations, allocations, allocationsLoading,
  } = o;

  useDocumentTitle(order ? (order.name ? `${order.orderNumber} - ${order.name}` : order.orderNumber) : null);

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
          <button className="btn btn-secondary" onClick={() => router.push('/purchase-orders')}>
            {tPurchase('backToOrders')}
          </button>
        </div>
      </>
    );
  }

  const sections = {
    details: { id: 'details-section', label: 'Details', show: true },
    allocations: { id: 'allocations-section', label: 'Allocations', show: true },
    receptions: { id: 'receptions-section', label: 'Receptions', show: true },
    invoices: { id: 'Invoices-section', label: 'Invoices', show: true },
    activity: { id: 'activity-section', label: 'Activity', show: true },
  };
  const visibleSections = Object.values(sections).filter(s => s.show);


  return (
    <>
      <DetailsLayout
        header={
          <EntityHeader
            title={order.orderNumber}
            subtitle={order.name || tPurchase('untitledOrder')}
            onBack={() => router.push('/purchase-orders')}
            isSaving={saving}
            badges={<StateBadge state={order.stateCode as ValidState} />}
            actions={
              <>
                <PageNav sections={visibleSections} />
                {headerDirty && isHeaderEditable && (
                  <button className="btn btn-primary btn-sm" onClick={saveHeader} disabled={saving}>
                    {tPurchase('buttons.save')}
                  </button>
                )}
                {visibleTransitions.map((t) => (
                  <button
                    key={t.state}
                    className={`btn btn-sm ${t.isDanger ? 'btn-danger' : t.isBack ? 'btn-secondary' : 'btn-primary'}`}
                    onClick={() => changeState(t.state)}
                  >
                    {t.icon === 'close' ? (
                      <span className="material-symbols-outlined mr-1" style={{ fontSize: 16 }}>close</span>
                    ) : (
                      t.icon
                    )}
                    {t.label}
                  </button>
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
          <button className="ml-3 text-xs underline" onClick={clearError}>{tCommon('dismiss')}</button>
        </div>
      )}

          {/* Order info card */}
          <div id="details-section" className="card">
            <div className="flex justify-between items-center mb-4">
              <h3 className="section-heading">
                {/* eslint-disable-next-line i18next/no-literal-string */}
                <span className="material-symbols-outlined">receipt_long</span>
                {tPurchase('orderDetails')}
              </h3>
              <button
                className="btn btn-secondary btn-sm"
                onClick={copyOrder}
                disabled={copying}
              >
                {copying ? tCommon('copying') : tPurchase('buttons.copyOrder')}
              </button>
            </div>
            <div className="grid grid-cols-2 gap-4">
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
                <div className="col-span-1">
                   {/* notes pushed to full width if needed, or matched next column */}
                </div>
                <div className="col-span-2">
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
          <div className="flex items-center justify-between mb-4">
            <div className="flex gap-0">
              <button
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
              </button>
              <button
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
              </button>
              {order.stateCode !== PURCHASE_ORDER_STATE.DRAFT && (
                <button
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
                  Status
                </button>
              )}
            </div>
            {isLinesEditable && activeTab === 'lines' && (
              <>
                <ProductSearchInput
                  onSelect={addLineFromProduct}
                  placeholder="Add product… (search)"
                  style={{ width: 240 }}
                />
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={addBlankLine}
                  disabled={saving}
                >
                  + {tPurchase('buttons.customLine')}
                </button>
              </>
            )}
          </div>

          {activeTab === 'lines' ? (
            <table className="table-lines">
              <thead>
                <tr>
                  <th style={{ width: 40 }}>{tPurchase('columns.lineNumber')}</th>
                  <th>{tPurchase('columns.product')}</th>
                  <th>{tPurchase('columns.description')}</th>
                  <th style={{ width: 90, textAlign: 'right' }}>{tPurchase('columns.qty')}</th>
                  <th style={{ width: 80, textAlign: 'right' }}>{tPurchase('columns.uom')}</th>
                  <th style={{ width: 110, textAlign: 'right' }}>{tPurchase('columns.unitPrice')}</th>
                  <th style={{ width: 80, textAlign: 'right' }}>{tPurchase('columns.discountPct' as any)}</th>
                  <th style={{ width: 110, textAlign: 'right' }}>{tPurchase('columns.tax' as any)}</th>
                  <th style={{ width: 110, textAlign: 'right' }}>{tPurchase('columns.amount')}</th>
                  {isLinesEditable && <th style={{ width: 50 }}></th>}
                </tr>
              </thead>
              <tbody>
                {order.lines.map((line) => (
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
                    <td>
                      {(!line.productId || line.productId === '00000000-0000-0000-0000-000000000000') && isLinesEditable ? (
                        <input
                          className="input"
                          style={{ width: '100%', fontSize: 13 }}
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
                        line.productDescription || '—'
                      )}
                    </td>
                    {isLinesEditable ? (
                      <>
                        <td style={{ textAlign: 'right' }}>
                          <input
                            className="input"
                            type="number"
                            min="0"
                            step="1"
                            style={{ width: '100%', textAlign: 'right' }}
                            defaultValue={line.quantity}
                            key={`qty-${line.purchaseOrderLineId}-${line.quantity}`}
                            onBlur={(e) => {
                              if (e.target.value !== line.quantity) {
                                updateLine(line.purchaseOrderLineId, 'quantity', e.target.value);
                              }
                            }}
                          />
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          {(() => {
                            const uoms: ProductUom[] = line.productUoms || [];
                            const defaultUom = line.baseUom || 'EA';
                            const selectOptions = uoms.length > 0 ? uoms : [{ uomCode: defaultUom, ratio: 1 }];
                            return (
                              <select
                                className="input"
                                style={{ width: '100%', fontSize: 13, textAlign: 'right' }}
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
                          })()}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <input
                            className="input"
                            type="number"
                            min="0"
                            step="0.01"
                            style={{ width: '100%', textAlign: 'right' }}
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
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <input
                            className="input"
                            type="number"
                            min="0"
                            max="100"
                            step="0.1"
                            style={{ width: '100%', textAlign: 'right' }}
                            defaultValue={line.discountPercentage}
                            key={`disc-${line.purchaseOrderLineId}-${line.discountPercentage}`}
                            onBlur={(e) => {
                              if (e.target.value !== line.discountPercentage) {
                                updateLine(line.purchaseOrderLineId, 'discountPercentage', e.target.value);
                              }
                            }}
                          />
                        </td>
                      </>
                    ) : (
                      <>
                        <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                          {line.quantity}
                        </td>
                        <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                          {/* eslint-disable-next-line no-restricted-syntax */}
                          {line.unitOfMeasure || line.baseUom || 'EA'}
                        </td>
                        <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                          {formatAmount(parseFloat(line.pricePerUnit || '0'), order.currencyCode || 'EUR')}
                        </td>
                        <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                          {parseFloat(line.discountPercentage || '0').toFixed(1)}%
                        </td>
                      </>
                    )}
                    {isLinesEditable ? (
                      <td style={{ textAlign: 'right' }}>
                        <select
                          className="input"
                          style={{ width: '100%', fontSize: 12, textAlign: 'right' }}
                          value={line.taxCategoryId || ''}
                          onChange={(e) => updateLine(line.purchaseOrderLineId, 'taxCategoryId', e.target.value)}
                        >
                          {taxCategories.map((c) => (
                            <option key={c.taxCategoryId} value={c.taxCategoryId}>
                              <TaxLabel category={c} />
                            </option>
                          ))}
                        </select>
                      </td>
                    ) : (
                      <td style={{ textAlign: 'right', fontSize: 12 }}>
                        {(() => {
                          const c = taxCategories.find((c) => c.taxCategoryId === line.taxCategoryId);
                          if (c) return <TaxLabel category={c} />;
                          // Legacy derivation
                          const amt = parseFloat(line.amount || '0');
                          const tax = parseFloat(line.tax || '0');
                          if (amt > 0 && tax > 0) {
                            const pct = (tax / amt) * 100;
                            return `${pct % 1 === 0 ? pct.toFixed(0) : pct.toFixed(1)}%`;
                          }
                          if (amt > 0 && tax === 0) return tCommon('taxLabels.exempt');
                          return '—';
                        })()}
                      </td>
                    )}
                    <td
                      style={{
                        textAlign: 'right',
                        fontWeight: 600,
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {formatAmount(parseFloat(line.amount || '0'), order.currencyCode || 'EUR')}
                    </td>
                    {isLinesEditable && (
                      <td>
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={() => removeLine(line.purchaseOrderLineId)}
                          title="Remove line"
                        >
                          <span dangerouslySetInnerHTML={{ __html: '&#10005;' }} />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
                {order.lines.length === 0 && (
                  <tr>
                    <td
                      colSpan={isLinesEditable ? 9 : 8}
                      style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '20px 0' }}
                    >
                      {tPurchase('noLineItems')}
                    </td>
                  </tr>
                )}
                {order.lines.length > 0 && (() => {
                  const taxPct = subtotal > 0 ? (totalTax / subtotal) * 100 : 0;
                  return (
                    <>
                      <tr style={{ borderTop: '2px solid var(--border)' }}>
                        <td colSpan={8} style={{ textAlign: 'right', fontWeight: 600, color: 'var(--text-muted)' }}>
                          {tCommon('subtotal')}
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                          {formatAmount(subtotal, order.currencyCode || 'EUR')}
                        </td>
                        {isLinesEditable && <td></td>}
                      </tr>
                      <tr>
                        <td colSpan={8} style={{ textAlign: 'right', fontWeight: 600, color: 'var(--text-muted)' }}>
                          {tCommon('tax')}{taxPct > 0 ? ` (${taxPct % 1 === 0 ? taxPct.toFixed(0) : taxPct.toFixed(1)}%)` : ''}
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                          {formatAmount(totalTax, order.currencyCode || 'EUR')}
                        </td>
                        {isLinesEditable && <td></td>}
                      </tr>
                      <tr style={{ backgroundColor: 'rgba(59,130,246,0.02)' }}>
                        <td colSpan={8} style={{ textAlign: 'right', fontWeight: 700, fontSize: 13, color: 'var(--text-primary)' }}>
                          {tCommon('total')}
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 800, fontSize: 14, color: 'var(--accent)', fontVariantNumeric: 'tabular-nums' }}>
                          {formatAmount(subtotal + totalTax, order.currencyCode || 'EUR')}
                        </td>
                        {isLinesEditable && <td></td>}
                      </tr>
                    </>
                  );
                })()}
              </tbody>
            </table>
          ) : activeTab === 'availability' ? (
            /* Availability tab */
            inventoryLoading ? (
              <p className="text-sm" style={{ color: 'var(--text-muted)', padding: '20px 0', textAlign: 'center' }}>{tPurchase('loadingInventory')}</p>
            ) : (
              <table className="table-lines">
                <thead>
                  <tr>
                    <th style={{ width: 40 }}>{tPurchase('columns.lineNumber')}</th>
                    <th>{tPurchase('columns.product')}</th>
                    <th>{tPurchase('columns.description')}</th>
                    <th style={{ width: 90, textAlign: 'right' }}>{tPurchase('columns.thisOrder')}</th>
                    <th style={{ width: 100, textAlign: 'right' }}>{tPurchase('columns.location')}</th>
                    <th style={{ width: 90, textAlign: 'right' }}>{tPurchase('columns.onHand')}</th>
                    <th style={{ width: 90, textAlign: 'right' }}>{tPurchase('columns.committed')}</th>
                    <th style={{ width: 90, textAlign: 'right' }}>{tPurchase('columns.ordered')}</th>
                    <th style={{ width: 90, textAlign: 'right' }}>{tPurchase('columns.reserved')}</th>
                    <th style={{ width: 90, textAlign: 'right' }}>{tPurchase('columns.available')}</th>
                    <th style={{ width: 70, textAlign: 'center' }}>{tPurchase('columns.status')}</th>
                  </tr>
                </thead>
                <tbody>
                  {order.lines.map((line) => {
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
                  })}
                  {order.lines.length === 0 && (
                    <tr>
                      <td colSpan={10} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '20px 0' }}>
                        {tPurchase('noLineItemsShort')}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )
          ) : activeTab === 'status' ? (
            /* Status / Bill Summary tab */
            <div className="overflow-x-auto">
                <table className="table-lines">
                    <thead>
                        <tr>
                            <th style={{ width: 40 }}>{tPurchase('columns.lineNumber')}</th>
                            <th>{tPurchase('columns.product')}</th>
                            <th>{tPurchase('columns.description')}</th>
                            <th style={{ textAlign: 'right' }}>{tPurchase('columns.ordered')}</th>
                            <th style={{ textAlign: 'right' }}>Allocated</th>
                            <th style={{ textAlign: 'right' }}>{tPurchase('columns.received')}</th>
                            <th style={{ textAlign: 'right' }}>{tPurchase('columns.billed')}</th>
                            <th style={{ textAlign: 'right' }}>{tPurchase('columns.remaining')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {(order.lines || []).map(line => {
                            const ordered = parseFloat(line.quantity || '0');
                            const received = parseFloat(line.quantityReceived || '0');
                            const allocated = allocations.reduce((sum, alloc) => {
                                return sum + (alloc.purchaseOrderLineId === line.purchaseOrderLineId ? parseFloat(alloc.quantity) : 0);
                            }, 0);
                            const billed = invoices.reduce((sum, inv) => {
                                const invLine = inv.lines?.find((il: any) => il.purchaseOrderLineId === line.purchaseOrderLineId);
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
                        })}
                        {order.lines.length === 0 && (
                          <tr>
                            <td colSpan={8} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '20px 0' }}>
                              {tPurchase('noLineItemsShort')}
                            </td>
                          </tr>
                        )}
                    </tbody>
                </table>
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
          loadOrder={loadOrder as any}
        />

        {/* Audit timeline */}
        <div id="activity-section" className="card">
          <ActivityTimeline events={order.events || []} />
        </div>
      </div>
      </DetailsLayout>

      {/* Global Toast Notification for Auto-Transitions */}
      <div
        className={`fixed bottom-6 right-6 rounded-lg p-4 max-w-[400px] z-[60] flex flex-col gap-1 pointer-events-none shadow-lg border border-[var(--border)] transition-all duration-300 ease-out ${latestAutoTransition ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0'
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
              state: tCommon(`states.${latestAutoTransition.to}` as any),
              reason: latestAutoTransition.reason.toLowerCase()
            })
          )}
        </p>
      </div>
    </>
  );
}

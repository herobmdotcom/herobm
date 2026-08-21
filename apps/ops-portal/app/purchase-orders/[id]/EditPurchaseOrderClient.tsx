'use client';

import { use, useMemo, useState } from 'react';
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
import { useAuth } from '@/components/shared/AuthGate';
import { SystemResource, hasPermission } from '@herobm/shared';
import PageNav from '@/components/shared/PageNav';
import { formatLocalDate } from '@/lib/date';
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
import PurchaseOrderLinesTab from './PurchaseOrderLinesTab';

import StateBadge from '@/components/StateBadge';
import { ValidState } from '@/types/states';

function TaxLabel({ category }: { category: TaxCategory }) {
  if (!category) return null;
  return <>{getTaxLabel(category)}</>;
}

interface CustomLineColumn extends DataTableColumn<OrderLine> {
  mobileCard?: (line: OrderLine, defaultRender?: React.ReactNode) => React.ReactNode;
}

export default function EditPurchaseOrderClient({ id }: { id: string }) {
  const router = useRouter();
  const tCommon = useTranslations('common');
  const tPurchase = useTranslations('purchaseOrders');
  const tSales = useTranslations('salesOrders');
  const tToast = useTranslations('toast');

  const { permissions } = useAuth();
  const canArchive = hasPermission(permissions, SystemResource.PURCHASE_ORDERS, 'archive');

  const o = usePurchaseOrder(id);

  const { order, loading, error, saving, copying, latestAutoTransition,
    isHeaderEditable, isLinesEditable, visibleTransitions, subtotal, totalTax,
    editName, setEditName, editReferenceNumber, setEditReferenceNumber,
    editExpectedDate, setEditExpectedDate,
    editNotes, setEditNotes, editLocationId, setEditLocationId, headerDirty,
    taxCategories, activeTab, setActiveTab, inventoryData, inventoryLoading,
    invoices, setInvoicing,
    clearError, setError, saveHeader, changeState, archivePurchaseOrder, unarchivePurchaseOrder, copyOrder,
    updateLine, updateLineFields, removeLine, addLineFromProduct, addBlankLine,
    loadOrder, loadInvoices, loadAllocations, allocations, allocationsLoading,
  } = o;

  useDocumentTitle(order ? (order.name ? `${order.orderNumber} - ${order.name}` : order.orderNumber) : null);

  const lineColumns: CustomLineColumn[] = useMemo(() => [
    {
        header: tPurchase('columns.lineNumber'), width: 40,
        render: (line) => <span className="text-[var(--text-muted)] font-normal relative">{line.lineNumber}</span>,
        mobileCard: () => null
    },
    {
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
                    step="any"
                    defaultValue={parseFloat(line.quantity || '0')}
                    key={`qty-${line.purchaseOrderLineId}-${line.quantity}`}
                    onBlur={(e) => {
                        if (e.target.value !== line.quantity) {
                            updateLine(line.purchaseOrderLineId, 'quantity', e.target.value);
                        }
                    }}
                />
            ) : <span className="text-sm tabular-nums">{parseFloat(line.quantity || '0')}</span>
        ),
        mobileCard: (line, defaultRender) => <MobileCardField label={tPurchase('columns.qty')} value={
            isLinesEditable ? defaultRender : <span className="text-sm">{parseFloat(line.quantity || '0')} {line.unitOfMeasure || line.baseUom || tCommon('ea')}</span>
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
        header: tPurchase('columns.amount'), width: 110, align: 'right',
        render: (line) => (
            <span className="font-medium tabular-nums">
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

  const navSections = useMemo(() => [
    { id: 'details-section', label: tPurchase('tabs.overview') },
    { id: 'lines-section', label: tPurchase('tabs.lines') },
    { id: 'allocations-section', label: tPurchase('tabs.allocations') },
    ...(order?.createdBy !== 'abm-import' ? [{ id: 'receptions-section', label: tPurchase('tabs.receptions') }] : []),
    { id: 'returns-section', label: tPurchase('tabs.returns') },
    { id: 'invoices-section', label: tPurchase('tabs.invoices') },
    { id: 'activity-section', label: tPurchase('tabs.activity') },
  ], [order?.createdBy, tPurchase]);

  if (loading) {
    return (
      <>
        <div className="flex items-center justify-center flex-1">
          <p className="text-[var(--text-muted)]">{tCommon('loading')}</p>
        </div>
      </>
    );
  }

  if (!order) {
    return (
      <>
        <div className="flex flex-col items-center justify-center flex-1">
          <p className="text-lg mb-2 text-[var(--danger)]">
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
            nav={<PageNav sections={navSections} />}
            actions={
              <>

                {visibleTransitions.map((t) => (
                  <Button
                    key={t.state}
                    variant={t.isDanger ? 'danger' : t.isBack ? 'secondary' : 'primary'}
                    size="sm"
                    onClick={() => changeState(t.state)}
                  >
                    {t.label}
                  </Button>
                ))}
              </>
            }
          />
        }
        footerActions={
          canArchive && order ? (
            order.stateCode === PURCHASE_ORDER_STATE.ARCHIVED ? (
              <Button
                variant="secondary"
                size="sm"
                onClick={unarchivePurchaseOrder}
                disabled={saving}
              >
                {tSales('buttons.unarchive')}
              </Button>
            ) : (order.stateCode === PURCHASE_ORDER_STATE.RECEIVED || order.stateCode === PURCHASE_ORDER_STATE.INVOICED || order.stateCode === PURCHASE_ORDER_STATE.CLOSED_SHORT || order.stateCode === PURCHASE_ORDER_STATE.CANCELLED) ? (
              <Button
                variant="secondary"
                size="sm"
                className="text-red-500 border-red-500 hover:bg-red-50 hover:text-red-600 hover:border-red-600"
                onClick={archivePurchaseOrder}
                disabled={saving}
              >
                {tSales('buttons.archive')}
              </Button>
            ) : undefined
          ) : undefined
        }
      >
        {order.stateCode === PURCHASE_ORDER_STATE.ARCHIVED && (
          <div className="px-4 mb-4 py-3 rounded-lg flex items-center gap-3 bg-amber-500/10 border border-amber-500/30 text-amber-700">
            <span className="text-xl">📦</span>
            <div>
              <strong className="font-semibold text-amber-800">{tSales('archivedBannerTitle')}</strong> {tSales('archivedBannerBody')}
            </div>
          </div>
        )}
      <div className="flex flex-col gap-3">

      {error && (
        <div
          className="px-4 py-3 rounded-lg text-sm bg-red-500/10 border border-red-500/30 text-red-400"
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
                  <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
                    {tPurchase('labels.supplier')}
                    {order.currencyCode && (
                      <span className="ml-2 px-1.5 py-0.5 rounded bg-blue-500/15 text-[var(--accent)] font-semibold text-[10px] tracking-[0.04em]">
                        {order.currencyCode}
                      </span>
                    )}
                  </label>
                  <div className="text-sm font-medium pt-1.5">
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
                  <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
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
                  <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
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
                    <p className="text-sm font-medium pt-1.5">
                      {formatLocalDate(order.expectedDate)}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
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
                  <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
                    {tPurchase('labels.created')}
                  </label>
                  <p className="text-sm font-medium pt-1.5">
                    {new Date(order.createdOn).toLocaleString()} {tCommon('by')} {order.createdBy || '—'}
                  </p>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
                    {tPurchase('labels.location')}
                  </label>
                  {isHeaderEditable && order.stateCode === PURCHASE_ORDER_STATE.DRAFT ? (
                    <LocationSelect
                      value={editLocationId || ''}
                      onChange={(loc) => setEditLocationId(loc)}
                      className="text-sm"
                    />
                  ) : (
                    <p className="text-sm font-medium pt-1.5">
                      {order.locationName || order.deliveryLocationId || '—'}
                    </p>
                  )}
                </div>
                <div className="hidden lg:block">
                   {/* notes pushed to full width if needed, or matched next column */}
                </div>
                <div className="lg:col-span-2">
                  <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
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
              <PurchaseOrderLinesTab
                order={order}
                inventoryData={inventoryData}
                inventoryLoading={inventoryLoading}
                allocations={allocations}
                invoices={invoices}
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                isLinesEditable={isLinesEditable}
                saving={saving}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Types mismatch with PurchaseOrderLinesTab
                updateLine={updateLine as any}
                updateLineFields={updateLineFields}
                removeLine={removeLine}
                addLineFromProduct={addLineFromProduct}
                addBlankLine={addBlankLine}
                subtotal={subtotal}
                totalTax={totalTax}
                taxCategories={taxCategories}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any -- next-intl TFunction types mismatch with Record
                tPurchase={tPurchase as any}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any -- next-intl TFunction types mismatch with Record
                tCommon={tCommon as any}
              />

        <AllocationsSection 
          orderId={id} 
          allocations={allocations} 
          loading={allocationsLoading} 
          onAllocationsChanged={loadAllocations} 
        />

        {order.createdBy !== 'abm-import' && <ReceptionsSection orderId={id} />}

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
        className={`fixed bottom-6 right-6 rounded-lg p-4 max-w-[400px] z-[60] flex flex-col gap-1 pointer-events-none border border-[var(--border)] bg-[var(--bg-card)] transition-all duration-300 ease-out ${latestAutoTransition ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0'}`}
      >
        <div className="flex items-center gap-2">
          <span className="text-[16px]">⚡</span>
          <strong className="text-[13px] text-[var(--text-primary)]">
            {tToast('orderStateUpdated')}
          </strong>
        </div>
        <p className="text-xs text-[var(--text-secondary)] m-0 leading-[1.4]">
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

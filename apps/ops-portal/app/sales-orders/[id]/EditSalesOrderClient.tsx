'use client';

import { use, useEffect, useState, useCallback, Fragment, useMemo } from 'react';
import { Button } from '@/components/shared/Button';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

import ProductSearchInput from '@/components/shared/ProductSearchInput';
import { reportError } from '@/lib/api';
import * as api from '@herobm/sdk';
import ActivityTimeline from '@/components/shared/ActivityTimeline';
import { formatAmount } from '@/lib/currency';
import { toast } from 'react-hot-toast';
import { useTranslations } from 'next-intl';
import EntityHeader from '@/components/shared/EntityHeader';
import EntityBanner from '@/components/shared/EntityBanner';
import { useAuth } from '@/components/shared/AuthGate';
import { SystemResource, isPhysicalProductLine, hasPermission } from '@herobm/shared';
import DetailsLayout from '@/components/shared/DetailsLayout';
import OrderLinesTab from './OrderLinesTab';
import DeliveryAddressSlideOver from '@/components/shared/DeliveryAddressSlideOver';
import PhoneInput from 'react-phone-number-input';
import 'react-phone-number-input/style.css';

const parseInitialPhone = (val: string) => {
  if (!val) return '';
  if (val.startsWith('+')) return val;
  const digits = val.replace(/\D/g, '');
  if (digits.length > 0) return '+' + digits;
  return '';
};

import PageNav from '@/components/shared/PageNav';
import { DataTable, MobileCardField } from '@/components/shared/DataTable';

import InvoicesSection from './InvoicesSection';
import ReturnsSection from './ReturnsSection';
import FulfillmentSection from './FulfillmentSection';
import ShipmentsSection from './ShipmentsSection';
import EmailDocumentDialog from '@/components/shared/EmailDocumentDialog';

import { formatLocationDisplay } from '@/lib/formatters';
import OrderDetailsCard from './OrderDetailsCard';
import OverrideCreditHoldModal from './OverrideCreditHoldModal';

import type { TaxCategory, OrderLine } from './types';
import { getTaxLabel } from './types';
import { useOrder } from './useOrder';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';

import {
    RETURN_STATE,
    RETURN_TRANSITIONS,
    RETURN_LIFECYCLE,
    SALES_ORDER_STATE,
    SALES_ORDER_LIFECYCLE as ORDER_LIFECYCLE,
    PURCHASE_ORDER_STATE,
    BACKORDER_STATE,
    isBackTransition as sharedIsBackTransition,
    cap,
    calculateUomPriceAdjustment,
    calculateInventoryGaps,
    DATA_SOURCE_CONTEXT
} from '@herobm/shared';
import type { ProductUom } from '@herobm/shared';
import StateBadge, { StateName } from '@/components/StateBadge';
import { ValidState } from '@/types/states';

interface BackorderItem {
    productId?: string;
    productNumber?: string;
    quantity?: string;
    stateCode: string;
    purchaseOrderId?: string;
    purchaseOrderNumber?: string;
    salesOrderId?: string;
    orderNumber?: string;
    name?: string;
    createdOn: string;
    lineNumber?: number | string;
    salesOrderLineId?: string;
    purchaseOrderState?: string;
    transferOrderId?: string;
    transferOrderNumber?: string;
    transferOrderState?: string;
}

function isBackTransition(
    from: string, to: string,
    lifecycle: Record<string, number> = ORDER_LIFECYCLE,
): boolean {
    return sharedIsBackTransition(lifecycle, from, to);
}


function EventIcon({ type }: { type: string }) {
    const t = useTranslations('common.eventTypes');
    const icons: Record<string, string> = {
        created: '🆕',
        updated: '✏️',
        status_changed: '🔄',
        line_added: '➕',
        line_updated: '📝',
        line_removed: '🗑️',
        quoted: '📨',
        confirmed: '✅',
        cancelled: '❌',
        archived: '📦',
        unarchived: '📦',
        shipment_created: '🚚',
        shipment_updated: '🚚',
        shipment_status_changed: '🚚',
        shipment_processed: '📫',
        shipment_line_added: '📦',
        shipment_line_updated: '📦',
        shipment_line_removed: '🗑️',
        picking_line_updated: '📦',
        picking_line_picked_all: '✅',
        picking_order_picked_all: '✅',
        return_created: '↩️',
        return_updated: '✏️',
        return_status_changed: '🔄',
        return_processed: '✅',
        return_line_added: '➕',
        return_line_updated: '✏️',
        return_line_removed: '🗑️',
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- External API integration boundaries where exact types are unknown.
    return <span className="mr-2" style={{ fontSize: '1.2rem', lineHeight: 1 }} title={t(type as any)}>{icons[type] || '📌'}</span>;
}

function PurchaseReturnStateBadge({ state }: { state: ValidState }) {
    const t = useTranslations('common.states');
    return <span className={`badge badge-return-${state}`}>{t(state)}</span>;
}



export default function EditSalesOrderClient({ id }: { id: string }) {
    const router = useRouter();
    const t = useTranslations();
    const tCommon = useTranslations('common');
    const tSales = useTranslations('salesOrders');
    const tToast = useTranslations('toast');
    const tConfirm = useTranslations('confirm');

    const o = useOrder(id);
    const [mainTab, setMainTab] = useState<string>('overview');

    const { permissions } = useAuth();
    const canManageCredit = hasPermission(permissions, SystemResource.CREDIT_CONTROL, 'write');
    const [showCreditOverrideModal, setShowCreditOverrideModal] = useState(false);

    /* ── Post-Confirmation Line UI State ───────────────────────────── */
    const [isPostConfirmationAddingEnabled, setIsPostConfirmationAddingEnabled] = useState(false);

    const [isAddressSlideOverOpen, setIsAddressSlideOverOpen] = useState(false);

    /* ── Quote Dialog ──────────────────────────────────────────────────────── */
    const [emailDialogConfig, setEmailDialogConfig] = useState<{
        isOpen: boolean;
        hookSlug: string;
        title: string;
        prefix: string;
        docName: string;
        targetId: string;
        contextSlug: string;
    }>({
        isOpen: false,
        hookSlug: '',
        title: '',
        prefix: '',
        docName: '',
        targetId: '',
        contextSlug: ''
    });

    /* ── Discrepancy Modal ─────────────────────────────────────────────────── */
    const [showDiscrepancyModal, setShowDiscrepancyModal] = useState(false);

    // Scroll to hash fragment (e.g. #invoices-section) after data loads
    useEffect(() => {
        if (o.loading || !o.order) return;
        const hash = window.location.hash;
        if (!hash) return;
        // Small delay to let sections render
        const timer = setTimeout(() => {
            const el = document.querySelector(hash);
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 300);
        return () => clearTimeout(timer);
    }, [o.loading, o.order]);

    useDocumentTitle(o.order ? (o.order.name ? `${o.order.orderNumber} - ${o.order.name}` : o.order.orderNumber) : null);

    if (o.loading) {
        return (
            <>
                <div className="flex items-center justify-center flex-1">
                    <p style={{ color: 'var(--text-muted)' }}>{tCommon('loading')}</p>
                </div>
            </>
        );
    }

    if (!o.order) {
        return (
            <>
                <div className="flex flex-col items-center justify-center flex-1">
                    <p className="text-lg mb-2" style={{ color: 'var(--danger)' }}>
                        {o.error || tSales('orderNotFound')}
                    </p>
                    <Button variant="secondary" onClick={() => router.push('/sales-orders')}>
                        {tSales('backToOrders')}
                    </Button>
                </div>
            </>
        );
    }

    // After null guard, destructure everything for JSX use
    const {
        order, error, setError, saving, locations,
        editName, setEditName, editPO, setEditPO, editNotes, setEditNotes, editFulfillmentLocationId, setEditFulfillmentLocationId, headerDirty,
        taxCategories,
        activeTab, setActiveTab, inventoryData, inventoryLoading,
        returns, returnsLoading, showCreateReturn, setShowCreateReturn,
        invoices, pickingSummary,
        isOrderDetailsEditable, isOrderLinesEditable,
        allowedTransitions, subtotal, totalTax,
        saveHeader, changeState, calculateTaxes, archiveOrder, unarchiveOrder,
        updateLine, updateLineFields, removeLine, addLineFromProduct, addBlankLine, addPostConfirmationBlankLine,
        loadOrder, loadReturns, loadInvoices,
        discrepanciesAcknowledged, setDiscrepanciesAcknowledged,
        customerDeliveryAddresses,
        customerCountry,
        customerName,
        editShippingNotes, setEditShippingNotes,
        editDeliveryCompanyName, setEditDeliveryCompanyName,
        editDeliveryName, setEditDeliveryName,
        editDeliveryPhone, setEditDeliveryPhone,
        editDeliveryAddressLine1, setEditDeliveryAddressLine1,
        editDeliveryAddressLine2, setEditDeliveryAddressLine2,
        editDeliveryCity, setEditDeliveryCity,
        editDeliveryState, setEditDeliveryState,
        editDeliveryPostalCode, setEditDeliveryPostalCode,
        editDeliveryCountry, setEditDeliveryCountry
    } = o;

    const selectedAddressId = customerDeliveryAddresses.find(a => a.addressLine1 === editDeliveryAddressLine1 && a.city === editDeliveryCity)?.deliveryAddressId || (editDeliveryAddressLine1 ? 'other' : '');

    const handleStateClick = async (state: string) => {
        if (headerDirty) {
            await saveHeader();
        }
        if (state === SALES_ORDER_STATE.CONFIRMED && gaps.length > 0 && !discrepanciesAcknowledged) {
            setShowDiscrepancyModal(true);
            return;
        }
        await changeState(state, state === SALES_ORDER_STATE.CONFIRMED, discrepanciesAcknowledged);
    };

    const handleGenerateQuote = async (text: string) => {
        try {
            const response = await api.pdfTemplatesControllerRunHook(
                'sales-order-quote', 
                { quoteIntroText: text }, 
                { id, context: 'sales-order' }
            );
            const blob = response.data ;
            const url = URL.createObjectURL(blob);
            window.open(url, '_blank');
            loadOrder(); // Reload to show the new timeline event
        } catch (err) {
            reportError(err, 'OrderDetailPage:generateQuote');
            setError(err instanceof Error ? err.message : tCommon('errors.failedToGenerateQuote'));
            throw err;
        }
    };

    /* ── Centralised section visibility rules ──────────────────────── */
    const PICKING_INVOICE_STATES: string[] = [
        SALES_ORDER_STATE.PICKING, 
        SALES_ORDER_STATE.SHIPPED, 
        SALES_ORDER_STATE.INVOICED, 
        'legacy',
        SALES_ORDER_STATE.ARCHIVED
    ];
    const navItems = [
        { id: 'overview', label: (tSales as (k: string) => string)('tabs.overview') || 'Overview', isActive: mainTab === 'overview', onClick: () => setMainTab('overview') },
        { id: 'lines', label: (tSales as (k: string) => string)('tabs.lines') || 'Lines', isActive: mainTab === 'lines', onClick: () => setMainTab('lines') },
        ...(PICKING_INVOICE_STATES.includes(order.stateCode) ? [
            { id: 'fulfillment', label: (tSales as (k: string) => string)('tabs.fulfillment') || 'Fulfillment', isActive: mainTab === 'fulfillment', onClick: () => setMainTab('fulfillment') },
            { id: 'shipments', label: (tSales as (k: string) => string)('tabs.shipments') || 'Shipments', isActive: mainTab === 'shipments', onClick: () => setMainTab('shipments') },
            { id: 'invoices', label: (tSales as (k: string) => string)('tabs.invoices') || 'Invoices', isActive: mainTab === 'invoices', onClick: () => setMainTab('invoices') },
            { id: 'returns', label: (tSales as (k: string) => string)('tabs.returns') || 'Returns', isActive: mainTab === 'returns', onClick: () => setMainTab('returns') }
        ] : [])
    ];
    
    // Pre-calculate gaps for the Availability tab
    const gaps = calculateInventoryGaps(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- External API boundary
        order.lines.map((l: any) => ({
            ...l,
            fulfillmentLocationId: (editFulfillmentLocationId && editFulfillmentLocationId !== order.fulfillmentLocationId && (!l.fulfillmentLocationId || l.fulfillmentLocationId === order.fulfillmentLocationId)) 
                ? editFulfillmentLocationId 
                : l.fulfillmentLocationId
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- External API boundary
        })) as any, 
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- External API boundary
        inventoryData.map((inv: any) => ({ 
            productId: inv.productId, 
            locationId: inv.locationId, 
            quantityAvailable: inv.quantityAvailable 
        })), 
        editFulfillmentLocationId || order.fulfillmentLocationId
    );
    const gapMap = new Map(gaps.map(g => [g.salesOrderLineId, g]));

    const isDraft = order.stateCode === SALES_ORDER_STATE.DRAFT;
    const isPreConfirmation = order.stateCode === SALES_ORDER_STATE.DRAFT || order.stateCode === SALES_ORDER_STATE.QUOTED;
    const isShipped = ([SALES_ORDER_STATE.SHIPPED, SALES_ORDER_STATE.INVOICED, SALES_ORDER_STATE.ARCHIVED, SALES_ORDER_STATE.CANCELLED] as string[]).includes(order.stateCode as string);
    const activeBackorders = new Set((order.backorders || [])
        .filter((bo: { stateCode?: string; productId?: string }) => bo.stateCode === BACKORDER_STATE.PENDING_SUPPLY || bo.stateCode === BACKORDER_STATE.AWAITING_RECEIPT)
        .map((bo: { stateCode?: string; productId?: string }) => bo.productId)
        .filter(Boolean));

    return (
        <>
            <DetailsLayout
                header={
                    <EntityHeader
                        title={order.orderNumber}
                        subtitle={order.name === order.orderNumber ? null : (order.name || tSales('untitledOrder'))}
                        isSaving={saving}
                        badges={order.stateCode ? <StateBadge state={order.stateCode as ValidState} /> : ''}
                        nav={<PageNav sections={navItems} />}
                        actions={
                            <>



                                {[...allowedTransitions]
                                    .filter(state => state !== SALES_ORDER_STATE.PICKING && state !== SALES_ORDER_STATE.SHIPPED && state !== SALES_ORDER_STATE.INVOICED)
                                    .sort((a, b) => {
                                        const aBack = isBackTransition(order.stateCode, a);
                                        const bBack = isBackTransition(order.stateCode, b);
                                        if (aBack !== bBack) return aBack ? -1 : 1;
                                        return 0;
                                    })
                                    .map((state) => {
                                        const back = isBackTransition(order.stateCode, state);
                                        return (
                                            <Button
                                                key={state}
                                                variant={state === SALES_ORDER_STATE.CANCELLED ? 'danger' : back ? 'secondary' : 'primary'}
                                                size="sm"
                                                onClick={() => handleStateClick(state)}
                                            >
                                                {state === SALES_ORDER_STATE.CANCELLED ? (
                                                    <>
                                                        {/* eslint-disable-next-line i18next/no-literal-string -- Hardcoded string exceptions for standard system IDs, technical constants, or non-translatable symbols (e.g., -- Material UI Icon). */}
                                                        <span className="material-symbols-outlined mr-1" style={{ fontSize: 16 }}>close</span>
                                                        {tCommon('cancel')}
                                                    </>
                                                ) : back ? (
                                                    <>← <StateName state={state as ValidState} /></>
                                                ) : (
                                                    <>→ <StateName state={state as ValidState} /></>
                                                )}
                                            </Button>
                                        );
                                    })}
                            </>
                        }
                    />
                }
            >



            {order.stateCode === SALES_ORDER_STATE.ARCHIVED && (
                <div
                    className="mb-4 px-4 py-3 rounded-lg flex items-center gap-3"
                    style={{
                        background: 'rgba(245, 158, 11, 0.1)',
                        border: '1px solid rgba(245, 158, 11, 0.3)',
                        color: '#b45309',
                    }}
                >
                    <span style={{ fontSize: '1.2rem' }}>📦</span>
                    <div>
                        <strong className="font-semibold text-amber-800">{tSales('archivedBannerTitle')}</strong> {tSales('archivedBannerBody')}
                    </div>
                </div>
            )}

            {!isShipped && order.isCreditBlocked && (
                <EntityBanner
                    type="error"
                    title={tSales('creditHold.activeTitle')}
                    description={tSales('creditHold.activeDesc')}
                    action={
                        canManageCredit ? (
                            <Button
                                variant="secondary"
                                size="sm"
                                className="bg-white text-red-700 hover:bg-red-50 border-red-200"
                                onClick={() => setShowCreditOverrideModal(true)}
                            >
                                {tSales('creditHold.overrideBtn')}
                            </Button>
                        ) : undefined
                    }
                />
            )}
            {!isShipped && !order.isCreditBlocked && order.creditHoldOverrideAt && (
                <EntityBanner
                    type="warning"
                    title={tSales('creditHold.overriddenTitle')}
                    description={tSales('creditHold.overriddenDesc')}
                />
            )}

            <div className="flex flex-col gap-3">
                {mainTab === 'overview' && (
                    <>
                    <OrderDetailsCard
                        order={order}
                        isOrderDetailsEditable={isOrderDetailsEditable}
                        editName={editName}
                        setEditName={setEditName}
                        editPO={editPO}
                        setEditPO={setEditPO}
                        editFulfillmentLocationId={editFulfillmentLocationId}
                        setEditFulfillmentLocationId={setEditFulfillmentLocationId}
                        editNotes={editNotes}
                        setEditNotes={setEditNotes}
                        saveHeader={saveHeader}
                        locations={locations}
                        onEmailDocumentClick={(hookSlug, title, prefix, docName, targetId, contextSlug) => setEmailDialogConfig({ isOpen: true, hookSlug, title, prefix, docName, targetId, contextSlug })}
                        reportError={reportError}
                        setError={setError}
                        customerDeliveryAddresses={customerDeliveryAddresses}
                        customerCountry={customerCountry}
                        editShippingNotes={editShippingNotes}
                        setEditShippingNotes={setEditShippingNotes}
                        editDeliveryCompanyName={editDeliveryCompanyName}
                        setEditDeliveryCompanyName={setEditDeliveryCompanyName}
                        editDeliveryName={editDeliveryName}
                        setEditDeliveryName={setEditDeliveryName}
                        editDeliveryPhone={editDeliveryPhone}
                        setEditDeliveryPhone={setEditDeliveryPhone}
                        editDeliveryAddressLine1={editDeliveryAddressLine1}
                        setEditDeliveryAddressLine1={setEditDeliveryAddressLine1}
                        editDeliveryAddressLine2={editDeliveryAddressLine2}
                        setEditDeliveryAddressLine2={setEditDeliveryAddressLine2}
                        editDeliveryCity={editDeliveryCity}
                        setEditDeliveryCity={setEditDeliveryCity}
                        editDeliveryState={editDeliveryState}
                        setEditDeliveryState={setEditDeliveryState}
                        editDeliveryPostalCode={editDeliveryPostalCode}
                        setEditDeliveryPostalCode={setEditDeliveryPostalCode}
                        editDeliveryCountry={editDeliveryCountry}
                        setEditDeliveryCountry={setEditDeliveryCountry}
                    />

                    <div id="activity-section" className="card mt-3">
                        <h3 className="section-heading mb-4">
                            { }
                            {/* eslint-disable-next-line i18next/no-literal-string -- Material icon text */}
                            <span className="material-symbols-outlined">history</span>
                            {tCommon('activity')}
                        </h3>
                        {order?.events?.length ? (
                            <ActivityTimeline
                                events={(order as { events: React.ComponentProps<typeof ActivityTimeline>['events'] }).events}
                            />
                        ) : (
                            <p className="text-sm text-gray-500 italic px-2">
                                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any -- next-intl hook */}
                                {(tCommon as any)('noActivityRecorded')}
                            </p>
                        )}
                    </div>
                    </>
                )}

                {mainTab === 'lines' && (
                    <OrderLinesTab
                        order={order}
                        saving={saving}
                        editFulfillmentLocationId={editFulfillmentLocationId}
                        inventoryData={inventoryData}
                        inventoryLoading={inventoryLoading}
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- React Props boundary
                        activeBackorders={activeBackorders as any}
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- React Props boundary
                        gapMap={gapMap as any}
                        isOrderLinesEditable={isOrderLinesEditable}
                        isOrderDetailsEditable={isOrderDetailsEditable}
                        isPostConfirmationAddingEnabled={isPostConfirmationAddingEnabled}
                        setIsPostConfirmationAddingEnabled={setIsPostConfirmationAddingEnabled}
                        addLineFromProduct={addLineFromProduct}
                        addBlankLine={addPostConfirmationBlankLine}
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- React Props boundary
                        updateLine={updateLine as any}
                        updateLineFields={updateLineFields}
                        removeLine={removeLine}
                        calculateTaxes={calculateTaxes}
                        taxCategories={taxCategories}
                        subtotal={subtotal}
                        totalTax={totalTax}
                        activeTab={activeTab}
                        setActiveTab={setActiveTab}
                    />
                )}
                {mainTab === 'fulfillment' && (
                    <FulfillmentSection orderId={id} pickingSummary={pickingSummary} order={order} />
                )}

                {mainTab === 'shipments' && (
                    <ShipmentsSection orderId={id} />
                )}

                {mainTab === 'invoices' && (
                    <InvoicesSection 
                        orderId={id}
                        order={order} 
                        invoices={invoices} 
                        returns={returns}
                        taxCategories={taxCategories}
                        pickingSummary={pickingSummary}
                        setError={setError}
                        loadInvoices={loadInvoices}
                        loadOrder={loadOrder}
                        onEmailDocumentClick={(hookSlug, title, prefix, docName, targetId, contextSlug) => setEmailDialogConfig({ isOpen: true, hookSlug, title, prefix, docName, targetId, contextSlug })}
                    />
                )}

                {mainTab === 'returns' && (
                    <ReturnsSection 
                        orderId={id}
                        order={order} 
                                                        returns={returns} 
                        returnsLoading={returnsLoading}
                        showCreateReturn={showCreateReturn}
                        setShowCreateReturn={setShowCreateReturn} 
                        setError={setError}
                        loadReturns={loadReturns}
                        loadOrder={loadOrder}
                        pickingSummary={pickingSummary}
                        taxCategories={taxCategories}
                        locations={locations}
                        onEmailDocumentClick={(hookSlug, title, prefix, docName, targetId, contextSlug) => setEmailDialogConfig({ isOpen: true, hookSlug, title, prefix, docName, targetId, contextSlug })}
                    />
                )}

            </div>

            </DetailsLayout>

            {order && (
                <EmailDocumentDialog
                    isOpen={emailDialogConfig.isOpen}
                    orderId={id}
                    orderNumber={order.orderNumber}
                    customerReference={order.customerOrderNumber}
                    customerId={order.customerId!}
                    hookSlug={emailDialogConfig.hookSlug}
                    title={emailDialogConfig.title}
                    defaultSubjectPrefix={emailDialogConfig.prefix}
                    documentName={emailDialogConfig.docName}
                    targetId={emailDialogConfig.targetId}
                    contextSlug={emailDialogConfig.contextSlug}
                    onClose={() => setEmailDialogConfig(prev => ({ ...prev, isOpen: false }))}
                    onSuccess={() => {
                        setEmailDialogConfig(prev => ({ ...prev, isOpen: false }));
                        toast.success('Email queued successfully!');
                    }}
                    onPreview={async (customPdfText?: string) => {
                        try {
                            const response = await api.pdfTemplatesControllerRunHook(emailDialogConfig.hookSlug, { customPdfText }, { 
                                id: emailDialogConfig.targetId || order.salesOrderId!, 
                                context: emailDialogConfig.contextSlug || DATA_SOURCE_CONTEXT.SALES_ORDER
                            });
                            const blob = response.data;
                            const url = URL.createObjectURL(blob);
                            window.open(url, '_blank');
                        } catch (err) {
                            reportError(err, 'OrderDetailPage:generateDocument');
                            setError(err instanceof Error ? err.message : tCommon('errors.failedToGenerateReport'));
                        }
                    }}
                />
            )}

            {order?.customerId && (
                <DeliveryAddressSlideOver
                    isOpen={isAddressSlideOverOpen}
                    onClose={() => setIsAddressSlideOverOpen(false)}
                    customerId={order.customerId}
                    customerName={customerName}
                    allowUnsaved={true}
                    defaultCountry={customerCountry}
                    existingData={{
                        companyName: editDeliveryCompanyName,
                        recipientName: editDeliveryName,
                        recipientPhone: editDeliveryPhone,
                        addressLine1: editDeliveryAddressLine1,
                        addressLine2: editDeliveryAddressLine2,
                        city: editDeliveryCity,
                        stateOrProvince: editDeliveryState,
                        postalCode: editDeliveryPostalCode,
                        country: editDeliveryCountry,
                    }}
                    onSaved={(addr, saved) => {
                        setEditDeliveryCompanyName(addr.companyName || '');
                        setEditDeliveryName(addr.recipientName || '');
                        setEditDeliveryPhone(addr.recipientPhone || '');
                        setEditDeliveryAddressLine1(addr.addressLine1 || '');
                        setEditDeliveryAddressLine2(addr.addressLine2 || '');
                        setEditDeliveryCity(addr.city || '');
                        setEditDeliveryState(addr.stateOrProvince || '');
                        setEditDeliveryPostalCode(addr.postalCode || '');
                        setEditDeliveryCountry(addr.country || '');
                        if (saved && (addr as api.DeliveryAddressResponseDto).deliveryAddressId) {
                            customerDeliveryAddresses.push(addr as api.DeliveryAddressResponseDto);
                        }
                        saveHeader({
                            deliveryCompanyName: addr.companyName || undefined,
                            deliveryName: addr.recipientName || undefined,
                            deliveryPhone: addr.recipientPhone || undefined,
                            deliveryAddressLine1: addr.addressLine1 || undefined,
                            deliveryAddressLine2: addr.addressLine2 || undefined,
                            deliveryCity: addr.city || undefined,
                            deliveryState: addr.stateOrProvince || undefined,
                            deliveryPostalCode: addr.postalCode || undefined,
                            deliveryCountry: addr.country || undefined,
                        });
                    }}
                />
            )}

            {showDiscrepancyModal && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl w-full max-w-2xl flex flex-col overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
                            <h2 className="text-xl font-bold text-gray-900">{tSales('discrepancies.title')}</h2>
                            <Button variant="ghost" onClick={() => setShowDiscrepancyModal(false)} className="!text-gray-400 hover:!text-gray-600 !p-2 h-auto !min-h-0 !min-w-0">
                                {/* eslint-disable-next-line i18next/no-literal-string -- Hardcoded string exceptions for standard system IDs, technical constants, or non-translatable symbols (e.g., -- Material UI Icon). */}
                                <span className="material-symbols-outlined">close</span>
                            </Button>
                        </div>
                        
                        <div className="p-6 flex flex-col gap-4">
                            <div className="max-h-96 overflow-y-auto border border-gray-200 rounded-lg">
                                <table className="w-full text-left border-collapse">
                                    <thead className="bg-gray-50 sticky top-0">
                                        <tr>
                                            <th className="px-4 py-2 text-[10px] font-bold text-gray-500 uppercase tracking-wider border-b border-gray-200">{tSales('columns.lineNumber')}</th>
                                            <th className="px-4 py-2 text-[10px] font-bold text-gray-500 uppercase tracking-wider border-b border-gray-200">{tSales('columns.product')}</th>
                                            <th className="px-4 py-2 text-[10px] font-bold text-gray-500 uppercase tracking-wider border-b border-gray-200">{tSales('columns.description')}</th>
                                            <th className="px-4 py-2 text-[10px] font-bold text-gray-500 uppercase tracking-wider border-b border-gray-200 text-right">{tSales('columns.ordered')}</th>
                                            <th className="px-4 py-2 text-[10px] font-bold text-gray-500 uppercase tracking-wider border-b border-gray-200 text-right">{tSales('columns.available')}</th>
                                            <th className="px-4 py-2 text-[10px] font-bold text-gray-500 uppercase tracking-wider border-b border-gray-200 text-right text-red-600">{tSales('columns.gap')}</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-200 bg-white">
                                        {order.lines
                                            .filter(l => gapMap.has(l.salesOrderLineId))
                                            .map((line) => {
                                                const gap = gapMap.get(line.salesOrderLineId);
                                                return (
                                                    <tr key={line.salesOrderLineId} className="hover:bg-gray-50 transition-colors">
                                                        <td className="px-4 py-3 text-xs text-gray-500 font-medium">{line.lineNumber}</td>
                                                        <td className="px-4 py-3 text-xs text-gray-900 font-bold">{line.productNumber}</td>
                                                        <td className="px-4 py-3 text-xs text-gray-600 truncate max-w-[150px]" title={line.productDescription}>{line.productDescription}</td>
                                                        <td className="px-4 py-3 text-xs text-gray-900 text-right font-medium">{gap?.orderedQuantity}</td>
                                                        <td className="px-4 py-3 text-xs text-gray-600 text-right">{gap?.availableQuantity}</td>
                                                        <td className="px-4 py-3 text-xs text-red-600 text-right font-bold">{gap?.shortage}</td>
                                                    </tr>
                                                );
                                            })
                                        }
                                    </tbody>
                                </table>
                            </div>

                            <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-gray-100">
                                <Button
                                    variant="secondary"
                                    onClick={() => setShowDiscrepancyModal(false)}
                                >
                                    {tCommon('cancel')}
                                </Button>
                                <Button 
                                    variant="primary" 
                                    onClick={async () => {
                                        setDiscrepanciesAcknowledged(true);
                                        setShowDiscrepancyModal(false);
                                        await changeState(SALES_ORDER_STATE.CONFIRMED, true, true);
                                    }}
                                >
                                    {tCommon('confirm')}
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {showCreditOverrideModal && (
                <OverrideCreditHoldModal
                    orderId={id}
                    onClose={() => setShowCreditOverrideModal(false)}
                    onSuccess={() => {
                        setShowCreditOverrideModal(false);
                        o.loadOrder();
                    }}
                />
            )}

            <style jsx>{`
                .table-lines {
                    width: 100%;
                    border-collapse: collapse;
                    margin-bottom: 1.5rem;
                }
                .table-lines th {
                    text-align: left;
                    padding: 10px 12px;
                    font-size: 11px;
                    font-weight: 700;
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                    color: var(--text-muted);
                    border-bottom: 2px solid var(--border);
                }
                .table-lines td {
                    padding: 12px;
                    font-size: 13px;
                    border-bottom: 1px solid var(--border);
                    vertical-align: middle;
                }

                .badge-draft { background: #f3f4f6; color: #374151; }
                .badge-quoted { background: #e0f2fe; color: #0369a1; }
                .badge-confirm { background: #ecfdf5; color: #047857; }
            `}</style>
        </>
    );
}

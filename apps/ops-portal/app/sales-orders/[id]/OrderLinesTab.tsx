'use client';

import { useRef, useEffect } from 'react';
import { Button } from '@/components/shared/Button';
import Tabs from '@/components/shared/Tabs';
import ProductSearchInput from '@/components/shared/ProductSearchInput';
import { useTranslations } from 'next-intl';
import type { TaxCategory, OrderLine, OrderDetail } from './types';
import { SALES_ORDER_STATE, SALES_ORDER_LIFECYCLE as ORDER_LIFECYCLE } from '@herobm/shared';
import type { Product } from '@/components/shared/ProductSearchInput';
import { OrderLinesTable } from './components/OrderLinesTable';
import { OrderAvailabilityTab } from './components/OrderAvailabilityTab';
import { OrderBackordersTab } from './components/OrderBackordersTab';

interface OrderLinesTabProps {
    order: OrderDetail | null | undefined;
    saving: boolean;
    editFulfillmentLocationId: string | null;
    inventoryData: import('./types').InventoryLevel[];
    inventoryLoading: boolean;
    activeBackorders: Set<string>;
    gapMap: Record<string, import('@herobm/shared').InventoryGap>;
    isOrderLinesEditable: boolean;
    isOrderDetailsEditable: boolean;
    isPostConfirmationAddingEnabled: boolean;
    setIsPostConfirmationAddingEnabled: (val: boolean) => void;
    addLineFromProduct: (product: Product) => void;
    addBlankLine: () => void;
    addCommentLine?: () => void;
    updateLine: (lineId: string, field: string, value: string | boolean | null | undefined | number) => Promise<void> | void;
    updateLineFields: (lineId: string, fields: Partial<OrderLine>) => Promise<void> | void;
    removeLine: (lineId: string) => void;
    calculateTaxes: () => void;
    taxCategories: TaxCategory[];
    subtotal: number;
    totalTax: number;
    activeTab: 'lines' | 'availability' | 'backorders';
    setActiveTab: (tab: 'lines' | 'availability' | 'backorders') => void;
}

export default function OrderLinesTab({
    order,
    saving,
    editFulfillmentLocationId,
    inventoryData,
    inventoryLoading,
    activeBackorders,
    gapMap,
    isOrderLinesEditable,
    isOrderDetailsEditable,
    isPostConfirmationAddingEnabled,
    setIsPostConfirmationAddingEnabled,
    addLineFromProduct,
    addBlankLine,
    addCommentLine,
    updateLine,
    updateLineFields,
    removeLine,
    calculateTaxes,
    taxCategories,
    subtotal,
    totalTax,
    activeTab,
    setActiveTab,
}: OrderLinesTabProps) {
    const tCommon = useTranslations('common');
    const tSales = useTranslations('salesOrders');
    
    if (!order) return null;
    
    const isPreConfirmation = order.stateCode === SALES_ORDER_STATE.DRAFT || order.stateCode === SALES_ORDER_STATE.QUOTED;
    const isShipped = ([SALES_ORDER_STATE.SHIPPED, SALES_ORDER_STATE.INVOICED, SALES_ORDER_STATE.ARCHIVED, SALES_ORDER_STATE.CANCELLED] as string[]).includes(order.stateCode as string);

    const prevLineCountRef = useRef<number | null>(null);
    useEffect(() => {
        const lineCount = (order?.lines || []).length;
        if (prevLineCountRef.current !== null && lineCount > prevLineCountRef.current) {
            const el = document.getElementById('lines-section-bottom') || document.getElementById('lines-section');
            if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
        }
        prevLineCountRef.current = lineCount;
    }, [order?.lines?.length]);

    return (
        <div className="w-full">
            <div id="lines-section" className="card">
                <div className="mb-4">
                    <Tabs<'lines' | 'availability' | 'backorders'>
                        tabs={[
                            { id: 'lines', label: tSales('lineItems') },
                            { id: 'availability', label: tSales('availability') },
                            { id: 'backorders', label: tSales('backordersTab') },
                        ]}
                        activeTab={activeTab}
                        onChange={setActiveTab}
                        actions={
                            <>
                                {(isOrderLinesEditable || (isOrderDetailsEditable && activeTab === 'lines' && isPostConfirmationAddingEnabled)) && (
                                    <>
                                        <div className="flex-1 min-w-[200px] max-w-sm">
                                            <ProductSearchInput
                                                onSelect={addLineFromProduct}
                                                placeholder={tSales('placeholders.searchProduct')}
                                                className="w-full"
                                                fulfillmentLocationId={editFulfillmentLocationId || order?.fulfillmentLocationId || undefined}
                                            />
                                        </div>
                                        <Button
                                            variant="secondary"
                                            size="sm"
                                            className="whitespace-nowrap"
                                            onClick={addBlankLine}
                                            disabled={saving}
                                        >
                                            {tSales('buttons.customLine')}
                                        </Button>
                                        {addCommentLine && (
                                            <Button
                                                variant="secondary"
                                                size="sm"
                                                className="whitespace-nowrap"
                                                onClick={addCommentLine}
                                                disabled={saving}
                                            >
                                                {tSales('buttons.commentLine')}
                                            </Button>
                                        )}
                                    </>
                                )}
                                {!isOrderLinesEditable && isOrderDetailsEditable && activeTab === 'lines' && !isPostConfirmationAddingEnabled && (ORDER_LIFECYCLE[order?.stateCode ?? ''] >= ORDER_LIFECYCLE[SALES_ORDER_STATE.CONFIRMED]) && (
                                    <Button
                                        variant="secondary"
                                        size="sm"
                                        className="whitespace-nowrap"
                                        onClick={() => {
                                             if (window.confirm(tSales('postConfirmationLineWarningBody'))) {
                                                setIsPostConfirmationAddingEnabled(true);
                                            }
                                        }}
                                        disabled={saving}
                                        title={tSales('postConfirmationLineWarningTitle')}
                                    >
                                        {tSales('buttons.addPostConfirmationLine')}
                                    </Button>
                                )}
                            </>
                        }
                    />
                </div>

                {activeTab === 'lines' && (
                    <OrderLinesTable 
                        order={order}
                        saving={saving}
                        isOrderLinesEditable={isOrderLinesEditable}
                        isOrderDetailsEditable={isOrderDetailsEditable}
                        isPostConfirmationAddingEnabled={isPostConfirmationAddingEnabled}
                        isPreConfirmation={isPreConfirmation}
                        gapMap={gapMap}
                        activeBackorders={activeBackorders}
                        updateLine={updateLine}
                        updateLineFields={updateLineFields}
                        removeLine={removeLine}
                        calculateTaxes={calculateTaxes}
                        taxCategories={taxCategories}
                        subtotal={subtotal}
                        totalTax={totalTax}
                    />
                )}
                {activeTab === 'availability' && (
                    <OrderAvailabilityTab
                        order={order}
                        inventoryData={inventoryData}
                        inventoryLoading={inventoryLoading}
                        gapMap={gapMap}
                        activeBackorders={activeBackorders}
                        editFulfillmentLocationId={editFulfillmentLocationId}
                        isPreConfirmation={isPreConfirmation}
                        isShipped={isShipped}
                    />
                )}
                {activeTab === 'backorders' && (
                    <OrderBackordersTab order={order} />
                )}
                <div id="lines-section-bottom" className="h-px w-full" />
            </div>
        </div>
    );
}

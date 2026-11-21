'use client';

import { useRef, useEffect, useState } from 'react';
import { Button } from '@/components/shared/Button';
import Tabs from '@/components/shared/Tabs';
import ProductQuickAddBar from '@/components/shared/ProductQuickAddBar';
import { useTranslations } from 'next-intl';
import type { TaxCategory, OrderLine, OrderDetail, OrderLinesActiveTab } from './types';
import { SALES_ORDER_STATE, SALES_ORDER_LIFECYCLE as ORDER_LIFECYCLE } from '@herobm/shared';
import type { Product } from '@/components/shared/ProductSearchInput';
import { OrderLinesTable } from './components/OrderLinesTable';
import { OrderAvailabilityTab } from './components/OrderAvailabilityTab';
import { OrderBackordersTab } from './components/OrderBackordersTab';
import { OrderPricingTab } from './components/OrderPricingTab';

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
    addLineFromProduct: (product: Product, quantity?: string, insertAtLineNumber?: number) => void | Promise<void>;
    addBlankLine: (insertAtLineNumber?: number) => void | Promise<void>;
    addCommentLine?: (insertAtLineNumber?: number) => void | Promise<void>;
    updateLine: (lineId: string, field: string, value: unknown) => Promise<void> | void;
    updateLineFields: (lineId: string, fields: Partial<OrderLine>) => Promise<void> | void;
    removeLine: (lineId: string) => void;
    reorderLines?: (lineIds: string[]) => Promise<void> | void;
    calculateTaxes: () => void;
    taxCategories: TaxCategory[];
    subtotal: number;
    totalTax: number;
    activeTab: OrderLinesActiveTab;
    setActiveTab: (tab: OrderLinesActiveTab) => void;
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
    reorderLines,
    calculateTaxes,
    taxCategories,
    subtotal,
    totalTax,
    activeTab,
    setActiveTab,
}: OrderLinesTabProps) {
    const tSales = useTranslations('salesOrders');
    const [insertAtLineNumber, setInsertAtLineNumber] = useState<number | null>(null);
    const [focusTrigger, setFocusTrigger] = useState(0);

    const prevLineCountRef = useRef<number | null>(null);
    useEffect(() => {
        const lineCount = (order?.lines || []).length;
        if (prevLineCountRef.current !== null && lineCount > prevLineCountRef.current && insertAtLineNumber === null) {
            const el = document.getElementById('lines-section-bottom') || document.getElementById('lines-section');
            if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
        }
        prevLineCountRef.current = lineCount;
    }, [order?.lines?.length, insertAtLineNumber]);

    if (!order) return null;

    const isPreConfirmation = order.stateCode === SALES_ORDER_STATE.DRAFT || order.stateCode === SALES_ORDER_STATE.QUOTED;
    const isShipped = ([SALES_ORDER_STATE.SHIPPED, SALES_ORDER_STATE.INVOICED, SALES_ORDER_STATE.ARCHIVED, SALES_ORDER_STATE.CANCELLED] as string[]).includes(order.stateCode as string);

    const handleInsertAbove = (lineNum: number) => {
        setInsertAtLineNumber(lineNum);
        setFocusTrigger((prev) => prev + 1);
    };

    const handleAddProduct = async (product: Product, quantity?: string) => {
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
        <div className="w-full">
            <div id="lines-section" className="card">
                <div className="mb-4">
                    <Tabs<OrderLinesActiveTab>
                        tabs={[
                            { id: 'lines', label: tSales('lineItems') },
                            { id: 'availability', label: tSales('availability') },
                            { id: 'backorders', label: tSales('backordersTab') },
                            { id: 'pricing', label: tSales('pricingTab') },
                        ]}
                        activeTab={activeTab}
                        onChange={setActiveTab}
                        actions={
                            <>
                                {(isOrderLinesEditable || (isOrderDetailsEditable && activeTab === 'lines' && isPostConfirmationAddingEnabled)) && (
                                    <>
                                        <div className="flex-1 min-w-[260px] max-w-md">
                                            <ProductQuickAddBar
                                                onAdd={handleAddProduct}
                                                placeholder={tSales('placeholders.searchProduct')}
                                                className="w-full"
                                                fulfillmentLocationId={editFulfillmentLocationId || order?.fulfillmentLocationId || undefined}
                                                disabled={saving}
                                                enableShortcut={activeTab === 'lines'}
                                                insertAtLineNumber={isOrderLinesEditable ? insertAtLineNumber : null}
                                                onCancelInsert={() => setInsertAtLineNumber(null)}
                                                focusTrigger={focusTrigger}
                                            />
                                        </div>
                                        <Button
                                            variant="secondary"
                                            size="icon"
                                            icon="playlist_add"
                                            iconClassName="text-[18px]"
                                            onClick={() => void handleAddBlank()}
                                            disabled={saving}
                                            title={tSales('buttons.customLine')}
                                            aria-label={tSales('buttons.customLine')}
                                        />
                                        {addCommentLine && (
                                            <Button
                                                variant="secondary"
                                                size="icon"
                                                icon="add_comment"
                                                iconClassName="text-[18px]"
                                                onClick={() => void handleAddComment()}
                                                disabled={saving}
                                                title={tSales('buttons.commentLine')}
                                                aria-label={tSales('buttons.commentLine')}
                                            />
                                        )}
                                    </>
                                )}
                                {!isOrderLinesEditable && isOrderDetailsEditable && activeTab === 'lines' && !isPostConfirmationAddingEnabled && (ORDER_LIFECYCLE[order?.stateCode ?? ''] >= ORDER_LIFECYCLE[SALES_ORDER_STATE.CONFIRMED]) && (
                                    <Button
                                        variant="secondary"
                                        size="icon"
                                        icon="add_circle"
                                        iconClassName="text-[18px]"
                                        onClick={() => {
                                            if (window.confirm(tSales('postConfirmationLineWarningBody'))) {
                                                setIsPostConfirmationAddingEnabled(true);
                                            }
                                        }}
                                        disabled={saving}
                                        title={tSales('buttons.addPostConfirmationLine')}
                                        aria-label={tSales('buttons.addPostConfirmationLine')}
                                    />
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
                        reorderLines={isOrderLinesEditable ? reorderLines : undefined}
                        insertAtLineNumber={isOrderLinesEditable ? insertAtLineNumber : null}
                        onInsertAbove={isOrderLinesEditable ? handleInsertAbove : undefined}
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
                {activeTab === 'pricing' && (
                    <OrderPricingTab order={order} />
                )}
                <div id="lines-section-bottom" className="h-px w-full" />
            </div>
        </div>
    );
}

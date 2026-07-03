'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { DataTable, MobileCardField } from '@/components/shared/DataTable';
import { Button } from '@/components/shared/Button';
import { reportError } from '@/lib/api';
import * as api from '@herobm/sdk';
import { formatAmount } from '@/lib/currency';
import { computeLinePrice, computeReturnCreditSummary, isPhysicalProductLine } from '@herobm/shared';
import { formatLocationDisplay } from '@/lib/formatters';

import type { OrderDetail, OrderReturn, TaxCategory } from './types';
import {
    RETURN_STATE,
    RETURN_TRANSITIONS,
    RETURN_LIFECYCLE,
    SALES_ORDER_STATE,
    isBackTransition as sharedIsBackTransition,
} from '@herobm/shared';
import StateBadge, { StateName } from '@/components/StateBadge';
import { ValidState } from '@/types/states';
import { useSettings } from '@/components/SettingsProvider';

function PurchaseReturnStateBadge({ state }: { state: ValidState }) {
    const t = useTranslations('common.states');
    return <span className={`badge badge-${state}`}>{t(state)}</span>;
}

interface NewReturnLine {
    salesOrderLineId: string;
    quantityReturned: string;
    reason: string;
    resolution: 'refund' | 'replace';
    returnFee: string;
    feeMode: 'absolute' | 'percentage';
    originalAmount: number;
}

interface ReturnsSectionProps {
    orderId: string;
    order: OrderDetail;
    returns: OrderReturn[];
    returnsLoading: boolean;
    showCreateReturn: boolean;
    setShowCreateReturn: (v: boolean) => void;
    setError: (msg: string) => void;
    loadReturns: () => Promise<void>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- DTO type workaround
  loadOrder: (autoTransitions?: Record<string, any>[], showSpinner?: boolean) => Promise<void>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- DTO type workaround
  pickingSummary?: Record<string, any> | null;
    taxCategories: TaxCategory[];
    locations: api.InventoryLocationResponseDto[];
    onEmailDocumentClick?: (hookSlug: string, title: string, prefix: string, docName: string, targetId: string, contextSlug: string) => void;
}

export default function ReturnsSection({
    orderId, order, returns, returnsLoading,
    showCreateReturn, setShowCreateReturn,
    setError, loadReturns, loadOrder, pickingSummary, taxCategories, locations,
    onEmailDocumentClick
}: ReturnsSectionProps) {
  const { baseCurrency } = useSettings();
    const t = useTranslations();
    const tCommon = useTranslations('common');
    const tSales = useTranslations('salesOrders');
    const tConfirm = useTranslations('confirm');

    // Local state
    const [saving, setSaving] = useState(false);
    const [returnLocations, setReturnLocations] = useState<Record<string, string>>({});
    const [newReturnNotes, setNewReturnNotes] = useState('');
    const [newReturnLocationId, setNewReturnLocationId] = useState(order.fulfillmentLocationId || '');
    const returnableLines = useMemo(() => 
        order.lines.filter(isPhysicalProductLine),
    [order.lines]);

    const [newReturnLines, setNewReturnLines] = useState<NewReturnLine[]>(() =>
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Workaround for DTO mismatch
        returnableLines.map((l: any) => ({
            salesOrderLineId: l.salesOrderLineId,
            quantityReturned: '',
            reason: '',
            resolution: 'refund',
            returnFee: '0',
            feeMode: 'absolute' as const,
            originalAmount: parseFloat(l.amount || '0'),
        })),
    );

    const handleCancel = () => {
        setShowCreateReturn(false);
        setNewReturnLines(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Workaround for DTO mismatch
            returnableLines.map((l: any) => ({
                salesOrderLineId: l.salesOrderLineId,
                quantityReturned: l.quantityReturned || '',
                reason: '',
                resolution: 'refund',
                returnFee: '0',
                feeMode: 'absolute' as const,
                originalAmount: parseFloat(l.amount || '0'),
            })),
        );
        setNewReturnNotes('');
        setNewReturnLocationId(order.fulfillmentLocationId || '');
    };

    const handleSave = async () => {
        setSaving(true);
        setError('');
        try {
            const lines = newReturnLines
                .filter((l) => l.quantityReturned && parseFloat(l.quantityReturned) > 0)
                .map((l) => ({
                    salesOrderLineId: l.salesOrderLineId,
                    quantityReturned: l.quantityReturned,
                    reason: l.reason || undefined,
                    resolution: l.resolution,
                    returnFee: l.returnFee || '0',
                }));
            await api.orderReturnsControllerCreateReturn(orderId, {
                notes: newReturnNotes || undefined,
                locationId: newReturnLocationId || undefined,
                lines: lines ,
            });
            handleCancel();
            await loadReturns();
            await loadOrder(undefined, false);
        } catch (err) {
            setError(err instanceof Error ? err.message : tCommon('errors.failedToCreateReturn'));
        } finally {
            setSaving(false);
        }
    };

    return (
        <div id="returns-section" className="card">
            <div className="flex items-center justify-between mb-2">
                <h3 className="section-heading">
                    { }
                    <span className="material-symbols-outlined">assignment_return</span>
                    {tSales('returnsHeading')}
                </h3>
                {!showCreateReturn && [
                    SALES_ORDER_STATE.PICKING,
                    SALES_ORDER_STATE.SHIPPED, 
                    SALES_ORDER_STATE.INVOICED
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- DTO type workaround
                ].includes(order.stateCode as any) && (
                    <Button
                        variant="secondary" size="sm"
                        onClick={() => setShowCreateReturn(true)}
                    >
                        {tSales('buttons.createReturn')}
                    </Button>
                )}
            </div>

            {/* Create return form */}
            {showCreateReturn && (
                <div style={{ marginBottom: 16, padding: 16, borderRadius: 8, border: '1px solid var(--border)' }}>
                    <div className="mb-3">
                        <strong style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                            {tSales('newReturn')}
                        </strong>
                    </div>

                    <div style={{ display: 'flex', gap: '12px', marginBottom: 12 }}>
                        <select
                            className="input"
                            style={{ flex: 1 }}
                            value={newReturnLocationId}
                            onChange={(e) => setNewReturnLocationId(e.target.value)}
                        >
                            <option value="" disabled>{tCommon('select')}...</option>
                            {locations.map((loc) => (
                                <option key={loc.locationId} value={loc.locationId}>
                                    {formatLocationDisplay(loc)}
                                </option>
                            ))}
                        </select>
                        <input
                            className="input w-full"
                            style={{ flex: 2 }}
                            value={newReturnNotes}
                            onChange={(e) => setNewReturnNotes(e.target.value)}
                            placeholder={tSales('placeholders.returnNotes')}
                        />
                    </div>

                    <DataTable
                        data={returnableLines}
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- DTO type workaround
                        keyExtractor={(line: any) => line.salesOrderLineId}
                        columns={[
                            { header: tSales('columns.lineNumber'), width: 40 },
                            { header: tSales('columns.product') },
                            { header: tSales('columns.description') },
                            { header: tSales('columns.shipped'), width: 90, align: 'right' },
                            { header: tSales('columns.returnQty'), width: 100, align: 'right' },
                            { header: tSales('columns.reason'), width: 180 },
                            { header: 'Resolution', width: 120 },
                            { header: tSales('columns.fee'), width: 140, align: 'right' }
                        ]}
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- DTO type workaround
                        renderCustomRow={(line: any, idx: number) => {
                            const rl = newReturnLines[idx];
                            if (!rl) return null;
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any -- DTO type workaround
                            const pLine = pickingSummary?.lines?.find((pl: any) => pl.salesOrderLineId === line.salesOrderLineId);
                            const shippedQty = pLine && pLine.quantityShipped != null ? parseFloat(pLine.quantityShipped) : 0;
                            return (
                                <tr key={line.salesOrderLineId}>
                                    <td style={{ color: 'var(--text-muted)' }}>{line.lineNumber}</td>
                                    <td style={{ fontWeight: 600, fontSize: 12 }}>
                                        {line.productNumber || line.productId?.substring(0, 8) || '—'}
                                    </td>
                                    <td>{line.productDescription || '—'}</td>
                                    <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                                        {shippedQty}
                                    </td>
                                    <td style={{ textAlign: 'right' }}>
                                        <input
                                            className="input"
                                            type="number"
                                            min="0"
                                            max={shippedQty || line.quantity}
                                            step="1"
                                            style={{
                                                width: 70, padding: '2px 6px', borderRadius: 4,
                                                border: '1px solid var(--border)', background: 'var(--surface)',
                                                color: 'var(--text)', fontSize: 13, textAlign: 'right',
                                            }}
                                            value={rl.quantityReturned}
                                            onChange={(e) => {
                                                const updated = [...newReturnLines];
                                                updated[idx] = { ...rl, quantityReturned: e.target.value };
                                                setNewReturnLines(updated);
                                            }}
                                            placeholder={tSales('placeholders.zero')}
                                        />
                                    </td>
                                    <td>
                                        <input
                                            className="input"
                                            style={{ width: '100%' }}
                                            value={rl.reason}
                                            onChange={(e) => {
                                                const updated = [...newReturnLines];
                                                updated[idx] = { ...rl, reason: e.target.value };
                                                setNewReturnLines(updated);
                                            }}
                                            placeholder={tSales('placeholders.reason')}
                                        />
                                    </td>
                                    <td>
                                        <select
                                            className="input text-sm"
                                            value={rl.resolution}
                                            onChange={(e) => {
                                                const updated = [...newReturnLines];
                                                updated[idx] = { ...rl, resolution: e.target.value as 'refund' | 'replace' };
                                                setNewReturnLines(updated);
                                            }}
                                        >
                                            <option value="refund">Refund</option>
                                            <option value="replace">Replace</option>
                                        </select>
                                    </td>
                                    <td style={{ textAlign: 'right' }}>
                                        <div className="flex items-center gap-1 justify-end">
                                            <select
                                                className="input"
                                                style={{ width: 50, fontSize: 11, padding: '4px 6px' }}
                                                value={rl.feeMode}
                                                onChange={(e) => {
                                                    const updated = [...newReturnLines];
                                                    const mode = e.target.value as 'absolute' | 'percentage';
                                                    if (mode === 'percentage' && rl.feeMode === 'absolute') {
                                                        const pct = rl.originalAmount > 0
                                                            ? ((parseFloat(rl.returnFee || '0') / rl.originalAmount) * 100).toFixed(1)
                                                            : '0';
                                                        updated[idx] = { ...rl, feeMode: mode, returnFee: pct };
                                                    } else if (mode === 'absolute' && rl.feeMode === 'percentage') {
                                                        const abs = (rl.originalAmount * parseFloat(rl.returnFee || '0') / 100).toFixed(2);
                                                        updated[idx] = { ...rl, feeMode: mode, returnFee: abs };
                                                    }
                                                    setNewReturnLines(updated);
                                                }}
                                            >
                                                <option value="absolute">$</option>
                                                <option value="percentage">%</option>
                                            </select>
                                            <input
                                                className="input"
                                                type="number"
                                                min="0"
                                                step="0.01"
                                                style={{ width: 80, textAlign: 'right' }}
                                                value={rl.returnFee}
                                                onChange={(e) => {
                                                    const updated = [...newReturnLines];
                                                    updated[idx] = { ...rl, returnFee: e.target.value };
                                                    setNewReturnLines(updated);
                                                }}
                                                onBlur={() => {
                                                    if (rl.feeMode === 'percentage') {
                                                        const updated = [...newReturnLines];
                                                        const abs = (rl.originalAmount * parseFloat(rl.returnFee || '0') / 100).toFixed(2);
                                                        updated[idx] = { ...rl, feeMode: 'absolute', returnFee: abs };
                                                        setNewReturnLines(updated);
                                                    }
                                                }}
                                            />
                                        </div>
                                    </td>
                                </tr>
                            );
                        }}
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- DTO type workaround
                        mobileCard={(line: any, idx: number) => {
                            const rl = newReturnLines[idx];
                            if (!rl) return null;
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any -- DTO type workaround
                            const pLine = pickingSummary?.lines?.find((pl: any) => pl.salesOrderLineId === line.salesOrderLineId);
                            const shippedQty = pLine && pLine.quantityShipped != null ? parseFloat(pLine.quantityShipped) : 0;
                            return (
                                <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] p-4 flex flex-col">
                                    <div className="flex justify-between items-start gap-2 mb-2">
                                        <div className="font-semibold text-sm text-[var(--accent)]">
                                            {line.productNumber || line.productId?.substring(0, 8) || '—'}
                                        </div>
                                        <div>
                                            <select
                                                className="input text-sm"
                                                value={rl.resolution}
                                                onChange={(e) => {
                                                    const updated = [...newReturnLines];
                                                    updated[idx] = { ...rl, resolution: e.target.value as 'refund' | 'replace' };
                                                    setNewReturnLines(updated);
                                                }}
                                            >
                                                <option value="refund">Refund</option>
                                                <option value="replace">Replace</option>
                                            </select>
                                        </div>
                                        <div className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded font-medium">#{line.lineNumber}</div>
                                    </div>
                                    <div className="text-sm text-slate-600 font-medium mb-3">
                                        {line.productDescription || '—'}
                                    </div>
                                    
                                    <div className="flex flex-col gap-0 border-t border-slate-100 pt-1">
                                        <MobileCardField label={tSales('columns.shipped')} value={
                                            <span>{shippedQty}</span>
                                        } />
                                        
                                        <div className="flex justify-between items-center py-2">
                                            <span className="text-xs font-medium text-slate-500">{tSales('columns.returnQty')}</span>
                                            <input
                                                className="input"
                                                type="number"
                                                min="0"
                                                max={shippedQty || line.quantity}
                                                step="1"
                                                style={{
                                                    width: 70, padding: '2px 6px', borderRadius: 4,
                                                    border: '1px solid var(--border)', background: 'var(--surface)',
                                                    color: 'var(--text)', fontSize: 13, textAlign: 'right',
                                                }}
                                                value={rl.quantityReturned}
                                                onChange={(e) => {
                                                    const updated = [...newReturnLines];
                                                    updated[idx] = { ...rl, quantityReturned: e.target.value };
                                                    setNewReturnLines(updated);
                                                }}
                                                placeholder={tSales('placeholders.zero')}
                                            />
                                        </div>
                                        
                                        <div className="flex flex-col gap-1 py-2">
                                            <span className="text-xs font-medium text-slate-500">{tSales('columns.reason')}</span>
                                            <input
                                                className="input"
                                                style={{ width: '100%' }}
                                                value={rl.reason}
                                                onChange={(e) => {
                                                    const updated = [...newReturnLines];
                                                    updated[idx] = { ...rl, reason: e.target.value };
                                                    setNewReturnLines(updated);
                                                }}
                                                placeholder={tSales('placeholders.reason')}
                                            />
                                        </div>
                                        
                                        <div className="flex justify-between items-center py-2 border-t border-slate-100 mt-1">
                                            <span className="text-xs font-medium text-slate-500">{tSales('columns.fee')}</span>
                                            <div className="flex items-center gap-1 justify-end">
                                                <select
                                                    className="input"
                                                    style={{ width: 50, fontSize: 11, padding: '4px 6px' }}
                                                    value={rl.feeMode}
                                                    onChange={(e) => {
                                                        const updated = [...newReturnLines];
                                                        const mode = e.target.value as 'absolute' | 'percentage';
                                                        if (mode === 'percentage' && rl.feeMode === 'absolute') {
                                                            const pct = rl.originalAmount > 0
                                                                ? ((parseFloat(rl.returnFee || '0') / rl.originalAmount) * 100).toFixed(1)
                                                                : '0';
                                                            updated[idx] = { ...rl, feeMode: mode, returnFee: pct };
                                                        } else if (mode === 'absolute' && rl.feeMode === 'percentage') {
                                                            const abs = (rl.originalAmount * parseFloat(rl.returnFee || '0') / 100).toFixed(2);
                                                            updated[idx] = { ...rl, feeMode: mode, returnFee: abs };
                                                        }
                                                        setNewReturnLines(updated);
                                                    }}
                                                >
                                                    <option value="absolute">$</option>
                                                    <option value="percentage">%</option>
                                                </select>
                                                <input
                                                    className="input"
                                                    type="number"
                                                    min="0"
                                                    step="0.01"
                                                    style={{ width: 80, textAlign: 'right' }}
                                                    value={rl.returnFee}
                                                    onChange={(e) => {
                                                        const updated = [...newReturnLines];
                                                        updated[idx] = { ...rl, returnFee: e.target.value };
                                                        setNewReturnLines(updated);
                                                    }}
                                                    onBlur={() => {
                                                        if (rl.feeMode === 'percentage') {
                                                            const updated = [...newReturnLines];
                                                            const abs = (rl.originalAmount * parseFloat(rl.returnFee || '0') / 100).toFixed(2);
                                                            updated[idx] = { ...rl, feeMode: 'absolute', returnFee: abs };
                                                            setNewReturnLines(updated);
                                                        }
                                                    }}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        }}
                        footer={(() => {
                            const activeFLines = newReturnLines.filter(l => l.quantityReturned && parseFloat(l.quantityReturned) > 0);
                            if (activeFLines.length === 0) return null;
                            const cc = order.currencyCode || 'AUD';
                            const summary = computeReturnCreditSummary(
                                activeFLines.map((rl) => {
                                    const origLine = order.lines.find(l => l.salesOrderLineId === rl.salesOrderLineId);
                                    const taxCat = taxCategories.find(c => c.taxCategoryId === origLine?.taxCategoryId);
                                    return {
                                        quantity: parseFloat(rl.quantityReturned || '0'),
                                        pricePerUnit: parseFloat(origLine?.pricePerUnit || '0'),
                                        discountPercentage: parseFloat(origLine?.discountPercentage || '0'),
                                        taxRate: parseFloat(taxCat?.rate || '0'),
                                        returnFee: parseFloat(rl.returnFee || '0'),
                                    };
                                }),
                            );
                            const { subtotal, totalTax, totalFees, netCredit } = summary;
                            return (
                                <>
                                    <tr className="hidden lg:table-row" style={{ borderTop: '2px solid var(--border)' }}>
                                        <td colSpan={6} style={{ textAlign: 'right', fontWeight: 600, fontSize: 12, color: 'var(--text-muted)' }}>
                                            {tSales('returns.totalCredit')}
                                        </td>
                                        <td></td>
                                        <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
                                            {formatAmount(subtotal, cc)}
                                        </td>
                                    </tr>
                                    <tr className="hidden lg:table-row">
                                        <td colSpan={6} style={{ textAlign: 'right', fontWeight: 600, fontSize: 12, color: 'var(--text-muted)' }}>
                                            {tSales('columns.tax')}
                                        </td>
                                        <td></td>
                                        <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
                                            {formatAmount(totalTax, cc)}
                                        </td>
                                    </tr>
                                    <tr className="hidden lg:table-row">
                                        <td colSpan={6} style={{ textAlign: 'right', fontWeight: 600, fontSize: 12, color: 'var(--text-muted)' }}>
                                            {tSales('returns.totalFees')}
                                        </td>
                                        <td></td>
                                        <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
                                            {totalFees > 0 ? `−${formatAmount(totalFees, cc)}` : formatAmount(0, cc)}
                                        </td>
                                    </tr>
                                    <tr className="hidden lg:table-row">
                                        <td colSpan={6} style={{ textAlign: 'right', fontWeight: 700, fontSize: 13 }}>
                                            {tSales('returns.netCredit')}
                                        </td>
                                        <td></td>
                                        <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 700, fontSize: 13 }}>
                                            {formatAmount(netCredit, cc)}
                                        </td>
                                    </tr>
                                    
                                    <tr className="lg:hidden">
                                        <td colSpan={6} className="py-1 text-xs font-medium text-slate-500 text-right pr-4">{tSales('returns.totalCredit')}</td>
                                        <td className="py-1 text-sm font-semibold text-right tabular-nums">{formatAmount(subtotal, cc)}</td>
                                    </tr>
                                    <tr className="lg:hidden">
                                        <td colSpan={6} className="py-1 text-xs font-medium text-slate-500 text-right pr-4">{tSales('columns.tax')}</td>
                                        <td className="py-1 text-sm font-semibold text-right tabular-nums">{formatAmount(totalTax, cc)}</td>
                                    </tr>
                                    <tr className="lg:hidden">
                                        <td colSpan={6} className="py-1 text-xs font-medium text-slate-500 text-right pr-4">{tSales('returns.totalFees')}</td>
                                        <td className="py-1 text-sm font-semibold text-right tabular-nums">{totalFees > 0 ? `−${formatAmount(totalFees, cc)}` : formatAmount(0, cc)}</td>
                                    </tr>
                                    <tr className="lg:hidden">
                                        <td colSpan={6} className="py-2 text-sm font-bold text-[var(--accent)] text-right pr-4">{tSales('returns.netCredit')}</td>
                                        <td className="py-2 text-base font-bold text-[var(--accent)] text-right tabular-nums">{formatAmount(netCredit, cc)}</td>
                                    </tr>
                                </>
                            );
                        })()}
                    />

                    <div className="flex items-center gap-2 mt-4">
                        <Button
                            variant="primary" size="sm"
                            disabled={saving || newReturnLines.every((l) => !l.quantityReturned || parseFloat(l.quantityReturned) <= 0)}
                            onClick={handleSave}
                        >
                            {tSales('buttons.saveReturn')}
                        </Button>
                        <Button variant="secondary" size="sm" onClick={handleCancel}>
                            {tCommon('cancel')}
                        </Button>
                    </div>
                </div>
            )}

            {/* Existing returns list */}
            {returnsLoading ? (
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{tSales('loadingReturns')}</p>
            ) : returns.length === 0 && !showCreateReturn ? (
                <div className="text-center py-6 text-sm" style={{ color: 'var(--text-muted)' }}>
                    {tSales('noReturns')}
                </div>
            ) : (
                <div className="flex flex-col gap-2">
                    {returns.map((ret) => {
                        return (
                            <Link
                                key={ret.returnId}
                                href={`/sales-returns/${ret.returnId}`}
                                className="flex items-center justify-between p-3 rounded-lg border border-[var(--border)] hover:bg-[var(--bg-card-hover)] transition-colors group"
                            >
                                <div className="flex items-center gap-3">
                                    <span className="material-symbols-outlined text-[var(--text-muted)] text-lg">assignment_return</span>
                                    <div>
                                        <div className="font-bold text-sm text-[var(--text-primary)]">
                                            {ret.returnNumber}
                                        </div>
                                        <div className="text-xs text-[var(--text-muted)]">
                                            {ret.createdOn ? new Date(ret.createdOn as string).toLocaleDateString() : '—'} {' \u00B7 '} {ret.lines?.length || 0}
                                            <span> {tCommon('tabs.lines').toLowerCase()} </span>
                                            {ret.createdBy && <span> {' \u00B7 '} {tCommon('timeline.by', { actor: ret.createdBy })}</span>}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <PurchaseReturnStateBadge state={ret.stateCode as ValidState} />
                                </div>
                            </Link>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

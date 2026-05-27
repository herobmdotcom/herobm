'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { DataTable, MobileCardField } from '@/components/shared/DataTable';
import { reportError } from '@/lib/api';
import * as api from '@modbm/sdk';
import { formatAmount } from '@/lib/currency';
import { computeLinePrice, computeReturnCreditSummary } from '@modbm/shared';
import { formatLocationDisplay } from '@/lib/formatters';

import type { OrderDetail, OrderReturn, TaxCategory } from './types';
import {
    RETURN_STATE,
    RETURN_TRANSITIONS,
    RETURN_LIFECYCLE,
    SALES_ORDER_STATE,
    isBackTransition as sharedIsBackTransition,
} from '@modbm/shared';
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
    loadOrder: (autoTransitions?: any[], showSpinner?: boolean) => Promise<void>;
    pickingSummary?: any;
    taxCategories: TaxCategory[];
    locations: { locationId: string; name: string; code?: string }[];
}

export default function ReturnsSection({
    orderId, order, returns, returnsLoading,
    showCreateReturn, setShowCreateReturn,
    setError, loadReturns, loadOrder, pickingSummary, taxCategories, locations,
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
    const [newReturnLines, setNewReturnLines] = useState<NewReturnLine[]>(() =>
        order.lines.map((l) => ({
            salesOrderLineId: l.salesOrderLineId,
            quantityReturned: '',
            reason: '',
            returnFee: '0',
            feeMode: 'absolute' as const,
            originalAmount: parseFloat(l.amount || '0'),
        })),
    );

    const handleCancel = () => {
        setShowCreateReturn(false);
        setNewReturnLines(
            order.lines.map((l) => ({
                salesOrderLineId: l.salesOrderLineId,
                quantityReturned: '',
                reason: '',
                returnFee: '0',
                feeMode: 'absolute' as const,
                originalAmount: parseFloat(l.amount || '0'),
            })),
        );
        setNewReturnNotes('');
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
                    returnFee: l.returnFee || '0',
                }));
            await api.orderReturnsControllerCreateReturn(orderId, {
                notes: newReturnNotes || undefined,
                lines: lines as any,
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
        <div className="card">
            <div className="flex items-center justify-between mb-2">
                <h3 className="section-heading">
                    {/* eslint-disable-next-line i18next/no-literal-string */}
                    <span className="material-symbols-outlined">assignment_return</span>
                    {tSales('returnsHeading')}
                </h3>
                {!showCreateReturn && [
                    SALES_ORDER_STATE.PICKING,
                    SALES_ORDER_STATE.SHIPPED, 
                    SALES_ORDER_STATE.INVOICED, 
                    SALES_ORDER_STATE.LEGACY
                ].includes(order.stateCode as any) && (
                    <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => setShowCreateReturn(true)}
                    >
                        {tSales('buttons.createReturn')}
                    </button>
                )}
            </div>

            {/* Create return form */}
            {showCreateReturn && (
                <div style={{ marginBottom: 16, padding: 16, borderRadius: 8, background: 'rgba(59, 130, 246, 0.05)', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
                    <div className="flex items-center justify-between mb-3">
                        <strong style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                            {/* eslint-disable-next-line i18next/no-literal-string */}
                            <span className="material-symbols-outlined text-[16px]">assignment_return</span>
                            {tSales('newReturn')}
                        </strong>
                        <button
                            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 16 }}
                            onClick={handleCancel}
                        >
                            {/* eslint-disable-next-line i18next/no-literal-string */}
                            <span aria-hidden>✕</span>
                        </button>
                    </div>

                    <div style={{ marginBottom: 12 }}>
                        <input
                            className="input w-full"
                            value={newReturnNotes}
                            onChange={(e) => setNewReturnNotes(e.target.value)}
                            placeholder={tSales('placeholders.returnNotes')}
                        />
                    </div>

                    <DataTable
                        data={order.lines}
                        keyExtractor={(line: any) => line.salesOrderLineId}
                        columns={[
                            { header: tSales('columns.lineNumber'), width: 40 },
                            { header: tSales('columns.product') },
                            { header: tSales('columns.description') },
                            { header: tSales('columns.shipped'), width: 90, align: 'right' },
                            { header: tSales('columns.returnQty'), width: 100, align: 'right' },
                            { header: tSales('columns.reason'), width: 180 },
                            { header: tSales('columns.fee'), width: 140, align: 'right' }
                        ]}
                        renderCustomRow={(line: any, idx: number) => {
                            const rl = newReturnLines[idx];
                            if (!rl) return null;
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
                        mobileCard={(line: any, idx: number) => {
                            const rl = newReturnLines[idx];
                            if (!rl) return null;
                            const pLine = pickingSummary?.lines?.find((pl: any) => pl.salesOrderLineId === line.salesOrderLineId);
                            const shippedQty = pLine && pLine.quantityShipped != null ? parseFloat(pLine.quantityShipped) : 0;
                            return (
                                <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] p-4 flex flex-col shadow-sm">
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
                                        <td colSpan={5} style={{ textAlign: 'right', fontWeight: 600, fontSize: 12, color: 'var(--text-muted)' }}>
                                            {tSales('returns.totalCredit')}
                                        </td>
                                        <td></td>
                                        <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
                                            {formatAmount(subtotal, cc)}
                                        </td>
                                    </tr>
                                    <tr className="hidden lg:table-row">
                                        <td colSpan={5} style={{ textAlign: 'right', fontWeight: 600, fontSize: 12, color: 'var(--text-muted)' }}>
                                            {tSales('columns.tax')}
                                        </td>
                                        <td></td>
                                        <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
                                            {formatAmount(totalTax, cc)}
                                        </td>
                                    </tr>
                                    <tr className="hidden lg:table-row">
                                        <td colSpan={5} style={{ textAlign: 'right', fontWeight: 600, fontSize: 12, color: 'var(--text-muted)' }}>
                                            {tSales('returns.totalFees')}
                                        </td>
                                        <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
                                            {totalFees > 0 ? `−${formatAmount(totalFees, cc)}` : formatAmount(0, cc)}
                                        </td>
                                        <td></td>
                                    </tr>
                                    <tr className="hidden lg:table-row">
                                        <td colSpan={5} style={{ textAlign: 'right', fontWeight: 700, fontSize: 13 }}>
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

                    <div className="flex items-center gap-2">
                        <button
                            className="btn btn-primary btn-sm"
                            disabled={saving || newReturnLines.every((l) => !l.quantityReturned || parseFloat(l.quantityReturned) <= 0)}
                            onClick={handleSave}
                        >
                            {tSales('buttons.saveReturn')}
                        </button>
                        <button className="btn btn-secondary btn-sm" onClick={handleCancel}>
                            {tCommon('cancel')}
                        </button>
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
                <div className="space-y-3">
                    {returns.map((ret) => {
                        let allowedRetTransitions = RETURN_TRANSITIONS[ret.stateCode] || [];
                        if (ret.stateCode === RETURN_STATE.CONFIRMED || ret.stateCode === RETURN_STATE.PARTIALLY_RECEIVED) {
                            allowedRetTransitions = allowedRetTransitions.filter((s: string) => s !== RETURN_STATE.RECEIVED && s !== RETURN_STATE.PARTIALLY_RECEIVED);
                        }
                        const isRetEditable = ret.stateCode === RETURN_STATE.DRAFT;
                        return (
                            <div
                                key={ret.returnId}
                                style={{
                                    padding: 14,
                                    borderRadius: 8,
                                    border: '1px solid var(--border)',
                                    background: 'var(--bg-card, #fff)',
                                }}
                            >
                                <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-3">
                                        <span style={{ fontWeight: 700, fontSize: 13 }}>{ret.returnNumber}</span>
                                        <PurchaseReturnStateBadge state={ret.stateCode as ValidState} />
                                        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                                            {new Date(ret.createdOn).toLocaleString()}
                                            {ret.createdBy && ` ${tCommon('by')} ${ret.createdBy}`}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="flex gap-2">
                                        {allowedRetTransitions.map((s: string) => (
                                            <button
                                                key={s}
                                                className={`btn btn-sm ${s === 'cancelled' ? 'btn-danger' : 'btn-primary'}`}
                                                onClick={async () => {
                                                    if (s === RETURN_STATE.PROCESSED) {
                                                        if (!confirm(tConfirm('processReturn'))) return;
                                                    }
                                                    try {
                                                        await api.orderReturnsControllerChangeReturnState(orderId, ret.returnId, {
                                                            body: JSON.stringify({ stateCode: s })
                                                        });
                                                        await loadReturns();
                                                        await loadOrder(undefined, false);
                                                    } catch (err) {
                                                        setError(err instanceof Error ? err.message : tCommon('errors.failedToChangeReturnState'));
                                                    }
                                                }}
                                            >
                                                → <StateName state={s as ValidState} />
                                            </button>
                                        ))}
                                        <button
                                            className="btn btn-secondary btn-sm"
                                            onClick={async () => {
                                                try {
                                                    const { apiFetchBlob } = await import('@/lib/api');
                                                    const blob = await apiFetchBlob(`/api/reports/hooks/return-slip/run?id=${ret.returnId}&context=sales-return`, { method: 'POST' });
                                                    const url = URL.createObjectURL(blob);
                                                    window.open(url, '_blank');
                                                } catch (err) {
                                                    setError(err instanceof Error ? err.message : tCommon('errors.failedToGenerateReport'));
                                                }
                                            }}
                                        >
                                            {tSales('buttons.returnSlip')}
                                        </button>
                                        {ret.stateCode === RETURN_STATE.PROCESSED && (
                                            <button
                                                className="btn btn-secondary btn-sm"
                                                onClick={async () => {
                                                    try {
                                                        const { apiFetchBlob } = await import('@/lib/api');
                                                        const blob = await apiFetchBlob(`/api/reports/hooks/sales-return-credit/run?id=${ret.returnId}&context=sales-return`, { method: 'POST' });
                                                        const url = URL.createObjectURL(blob);
                                                        window.open(url, '_blank');
                                                    } catch (err) {
                                                        // Fallback to existing error setter
                                                        setError(err instanceof Error ? err.message : tCommon('errors.failedToGenerateReport'));
                                                    }
                                                }}
                                            >
                                                {tSales('buttons.salesCredit')}
                                            </button>
                                        )}
                                        </div>
                                    </div>
                                </div>

                                {ret.notes && (
                                    <p className="text-xs mb-2" style={{ color: 'var(--text-secondary)' }}>
                                        {ret.notes}
                                    </p>
                                )}

                                {ret.creditNoteNumber && (
                                    <div className="flex items-center gap-2 mb-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
                                        {/* eslint-disable i18next/no-literal-string */}
                        <span className="material-symbols-outlined" style={{ fontSize: 14 }}>receipt_long</span>
                        {/* eslint-enable i18next/no-literal-string */}
                                        <span style={{ fontWeight: 600 }}>{tSales('returns.creditNote')}:</span>
                                        <span>{ret.creditNoteNumber}</span>
                                    </div>
                                )}

                                <DataTable
                                    data={ret.lines}
                                    keyExtractor={(rl: any) => rl.returnLineId}
                                    columns={[
                                        { header: tSales('columns.product'), width: 150 },
                                        { header: tSales('columns.description') },
                                        { header: tSales('columns.returnQty'), width: 90, align: 'right' },
                                        { header: tSales('columns.unitPrice'), align: 'right' },
                                        { header: tSales('columns.discountPct'), align: 'right' },
                                        { header: tSales('columns.tax'), align: 'right' },
                                        { header: tSales('columns.reason'), width: 180 },
                                        { header: tSales('columns.fee'), width: 100, align: 'right' },
                                        { header: tSales('columns.amount'), width: 100, align: 'right' },
                                        ...(isRetEditable ? [{ header: '', width: 50 }] : [])
                                    ]}
                                    renderCustomRow={(rl: any) => {
                                        const origLine = order.lines.find((l) => l.salesOrderLineId === rl.salesOrderLineId);
                                        const disc = parseFloat(origLine?.discountPercentage || '0');
                                        const taxCat = taxCategories.find(c => c.taxCategoryId === origLine?.taxCategoryId);
                                        const taxRate = parseFloat(taxCat?.rate || '0');
                                        const cc = order.currencyCode || baseCurrency;
                                        const pricing = computeLinePrice({
                                            quantity: parseFloat(rl.quantityReturned || '0'),
                                            pricePerUnit: parseFloat(origLine?.pricePerUnit || '0'),
                                            discountPercentage: disc,
                                            taxRate: taxRate,
                                        });
                                        return (
                                            <tr key={rl.returnLineId}>
                                                <td>
                                                    <span style={{ fontWeight: 600, fontSize: 12 }}>
                                                        {origLine?.productNumber || origLine?.productId?.substring(0, 8) || '—'}
                                                    </span>
                                                </td>
                                                <td>
                                                    <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                                                        {origLine?.productDescription || '—'}
                                                    </span>
                                                </td>
                                                <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                                                    {isRetEditable ? (
                                                        <input
                                                            className="input"
                                                            type="number"
                                                            min="1"
                                                            step="1"
                                                            style={{ width: '100%', textAlign: 'right' }}
                                                            defaultValue={rl.quantityReturned}
                                                            key={`retqty-${rl.returnLineId}-${rl.quantityReturned}`}
                                                            onBlur={async (e) => {
                                                                if (e.target.value !== rl.quantityReturned) {
                                                                    try {
                                                                        await api.orderReturnsControllerUpdateReturnLine(
                                                                            orderId,
                                                                            ret.returnId,
                                                                            rl.returnLineId,
                                                                            { quantityReturned: e.target.value } as any
                                                                        );
                                                                        await loadReturns();
                                                                    } catch (err) {
                                                                        setError(err instanceof Error ? err.message : tCommon('errors.failedToUpdateReturnLine'));
                                                                    }
                                                                }
                                                            }}
                                                        />
                                                    ) : (
                                                        rl.quantityReturned
                                                    )}
                                                </td>
                                                <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                                                    {formatAmount(parseFloat(origLine?.pricePerUnit || '0'), cc)}
                                                </td>
                                                <td style={{ textAlign: 'right', color: disc > 0 ? 'inherit' : 'var(--text-muted)' }}>
                                                    {disc.toFixed(1)}%
                                                </td>
                                                <td style={{ textAlign: 'right', color: taxRate > 0 ? 'inherit' : 'var(--text-muted)' }}>
                                                    {taxRate.toFixed(1)}%
                                                </td>
                                                <td>
                                                    {isRetEditable ? (
                                                        <input
                                                            className="input"
                                                            style={{ width: '100%' }}
                                                            defaultValue={rl.reason || ''}
                                                            key={`retrsn-${rl.returnLineId}-${rl.reason}`}
                                                            onBlur={async (e) => {
                                                                if (e.target.value !== (rl.reason || '')) {
                                                                    try {
                                                                        await api.orderReturnsControllerUpdateReturnLine(
                                                                            orderId,
                                                                            ret.returnId,
                                                                            rl.returnLineId,
                                                                            { reason: e.target.value } as any
                                                                        );
                                                                        await loadReturns();
                                                                    } catch (err) {
                                                                        setError(err instanceof Error ? err.message : tCommon('errors.failedToUpdateReturnLine'));
                                                                    }
                                                                }
                                                            }}
                                                            placeholder={tSales('placeholders.reason')}
                                                        />
                                                    ) : (
                                                        <span style={{ fontSize: 12 }}>{rl.reason || '—'}</span>
                                                    )}
                                                </td>
                                                <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                                                    {isRetEditable ? (
                                                        <input
                                                            className="input"
                                                            type="number"
                                                            min="0"
                                                            step="0.01"
                                                            style={{ width: '100%', textAlign: 'right' }}
                                                            defaultValue={parseFloat(rl.returnFee || '0').toFixed(2)}
                                                            key={`retfee-${rl.returnLineId}-${rl.returnFee}`}
                                                            onBlur={async (e) => {
                                                                const val = parseFloat(e.target.value);
                                                                const formatted = isNaN(val) ? '0.00' : val.toFixed(2);
                                                                if (formatted !== parseFloat(rl.returnFee || '0').toFixed(2)) {
                                                                    try {
                                                                        await api.orderReturnsControllerUpdateReturnLine(
                                                                            orderId,
                                                                            ret.returnId,
                                                                            rl.returnLineId,
                                                                            { returnFee: formatted } as any
                                                                        );
                                                                        await loadReturns();
                                                                    } catch (err) {
                                                                        setError(err instanceof Error ? err.message : tCommon('errors.failedToUpdateReturnLine'));
                                                                    }
                                                                }
                                                            }}
                                                        />
                                                    ) : (
                                                        formatAmount(parseFloat(rl.returnFee || '0'), order.currencyCode || baseCurrency)
                                                    )}
                                                </td>
                                                <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                                                    {formatAmount(pricing.amount, order.currencyCode || baseCurrency)}
                                                </td>
                                                {isRetEditable && (
                                                    <td>
                                                        <button
                                                            className="btn btn-danger btn-sm"
                                                            onClick={async () => {
                                                                if (!confirm(tConfirm('removeReturnLine'))) return;
                                                                try {
                                                                    await api.orderReturnsControllerRemoveReturnLine(
                                                                        orderId,
                                                                        ret.returnId,
                                                                        rl.returnLineId
                                                                    );
                                                                    await loadReturns();
                                                                } catch (err) {
                                                                    setError(err instanceof Error ? err.message : t('common.errors.failedToRemoveReturnLine'));
                                                                }
                                                            }}
                                                            title={t('salesOrders.buttons.removeReturnLine')}
                                                        >
                                                            <span dangerouslySetInnerHTML={{ __html: '&#10005;' }} />
                                                        </button>
                                                    </td>
                                                )}
                                            </tr>
                                        );
                                    }}
                                    mobileCard={(rl: any) => {
                                        const origLine = order.lines.find((l) => l.salesOrderLineId === rl.salesOrderLineId);
                                        const disc = parseFloat(origLine?.discountPercentage || '0');
                                        const taxCat = taxCategories.find(c => c.taxCategoryId === origLine?.taxCategoryId);
                                        const taxRate = parseFloat(taxCat?.rate || '0');
                                        const cc = order.currencyCode || baseCurrency;
                                        const pricing = computeLinePrice({
                                            quantity: parseFloat(rl.quantityReturned || '0'),
                                            pricePerUnit: parseFloat(origLine?.pricePerUnit || '0'),
                                            discountPercentage: disc,
                                            taxRate: taxRate,
                                        });
                                        
                                        return (
                                            <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] p-4 flex flex-col shadow-sm">
                                                <div className="flex justify-between items-start gap-2 mb-2">
                                                    <div className="font-semibold text-sm text-[var(--accent)]">
                                                        {origLine?.productNumber || origLine?.productId?.substring(0, 8) || '—'}
                                                    </div>
                                                    {isRetEditable && (
                                                        <button
                                                            className="text-red-500 hover:bg-red-50 p-1.5 rounded"
                                                            onClick={async () => {
                                                                if (!confirm(tConfirm('removeReturnLine'))) return;
                                                                try {
                                                                    await api.orderReturnsControllerRemoveReturnLine(
                                                                        orderId,
                                                                        ret.returnId,
                                                                        rl.returnLineId
                                                                    );
                                                                    await loadReturns();
                                                                } catch (err) {
                                                                    setError(err instanceof Error ? err.message : t('common.errors.failedToRemoveReturnLine'));
                                                                }
                                                            }}
                                                            title={t('salesOrders.buttons.removeReturnLine')}
                                                        >
                                                            {/* eslint-disable-next-line i18next/no-literal-string */}
                                                            <span className="material-symbols-outlined text-[16px]">delete</span>
                                                        </button>
                                                    )}
                                                </div>
                                                <div className="text-sm text-slate-600 font-medium mb-3">
                                                    {origLine?.productDescription || '—'}
                                                </div>
                                                
                                                <div className="flex flex-col gap-0 border-t border-slate-100 pt-1">
                                                    <div className="flex justify-between items-center py-2">
                                                        <span className="text-xs font-medium text-slate-500">{tSales('columns.returnQty')}</span>
                                                        {isRetEditable ? (
                                                            <input
                                                                className="input"
                                                                type="number"
                                                                min="1"
                                                                step="1"
                                                                style={{ width: 70, textAlign: 'right' }}
                                                                defaultValue={rl.quantityReturned}
                                                                key={`retqty-${rl.returnLineId}-${rl.quantityReturned}`}
                                                                onBlur={async (e) => {
                                                                    if (e.target.value !== rl.quantityReturned) {
                                                                        try {
                                                                            await api.orderReturnsControllerUpdateReturnLine(
                                                                                orderId,
                                                                                ret.returnId,
                                                                                rl.returnLineId,
                                                                                { quantityReturned: e.target.value } as any
                                                                            );
                                                                            await loadReturns();
                                                                        } catch (err) {
                                                                            setError(err instanceof Error ? err.message : tCommon('errors.failedToUpdateReturnLine'));
                                                                        }
                                                                    }
                                                                }}
                                                            />
                                                        ) : (
                                                            <span className="font-medium text-sm tabular-nums">{rl.quantityReturned}</span>
                                                        )}
                                                    </div>
                                                    
                                                    <div className="flex flex-col gap-1 py-2">
                                                        <span className="text-xs font-medium text-slate-500">{tSales('columns.reason')}</span>
                                                        {isRetEditable ? (
                                                            <input
                                                                className="input"
                                                                style={{ width: '100%' }}
                                                                defaultValue={rl.reason || ''}
                                                                key={`retrsn-${rl.returnLineId}-${rl.reason}`}
                                                                onBlur={async (e) => {
                                                                    if (e.target.value !== (rl.reason || '')) {
                                                                        try {
                                                                            await api.orderReturnsControllerUpdateReturnLine(
                                                                                orderId,
                                                                                ret.returnId,
                                                                                rl.returnLineId,
                                                                                { reason: e.target.value } as any
                                                                            );
                                                                            await loadReturns();
                                                                        } catch (err) {
                                                                            setError(err instanceof Error ? err.message : tCommon('errors.failedToUpdateReturnLine'));
                                                                        }
                                                                    }
                                                                }}
                                                                placeholder={tSales('placeholders.reason')}
                                                            />
                                                        ) : (
                                                            <span className="text-sm">{rl.reason || '—'}</span>
                                                        )}
                                                    </div>
                                                    
                                                    <div className="flex justify-between items-center py-2 border-t border-slate-100 mt-1">
                                                        <span className="text-xs font-medium text-slate-500">{tSales('columns.fee')}</span>
                                                        {isRetEditable ? (
                                                            <input
                                                                className="input"
                                                                type="number"
                                                                min="0"
                                                                step="0.01"
                                                                style={{ width: 80, textAlign: 'right' }}
                                                                defaultValue={parseFloat(rl.returnFee || '0').toFixed(2)}
                                                                key={`retfee-${rl.returnLineId}-${rl.returnFee}`}
                                                                onBlur={async (e) => {
                                                                    const val = parseFloat(e.target.value);
                                                                    const formatted = isNaN(val) ? '0.00' : val.toFixed(2);
                                                                    if (formatted !== parseFloat(rl.returnFee || '0').toFixed(2)) {
                                                                        try {
                                                                            await api.orderReturnsControllerUpdateReturnLine(
                                                                                orderId,
                                                                                ret.returnId,
                                                                                rl.returnLineId,
                                                                                { returnFee: formatted } as any
                                                                            );
                                                                            await loadReturns();
                                                                        } catch (err) {
                                                                            setError(err instanceof Error ? err.message : tCommon('errors.failedToUpdateReturnLine'));
                                                                        }
                                                                    }
                                                                }}
                                                            />
                                                        ) : (
                                                            <span className="font-medium text-sm tabular-nums text-slate-700">
                                                                {formatAmount(parseFloat(rl.returnFee || '0'), order.currencyCode || baseCurrency)}
                                                            </span>
                                                        )}
                                                    </div>
                                                    
                                                    <div className="flex justify-between items-center py-2">
                                                        <span className="text-xs font-medium text-slate-500">{tSales('columns.amount')}</span>
                                                        <span className="font-semibold text-sm tabular-nums text-[var(--accent)]">
                                                            {formatAmount(pricing.amount, order.currencyCode || baseCurrency)}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    }}
                                    emptyMessage={t('salesOrders.noReturnLines')}
                                    footer={(() => {
                                        if (ret.lines.length === 0) return null;
                                        
                                        const summary = computeReturnCreditSummary(
                                            ret.lines.map((rl) => {
                                                const origLine = order.lines.find((l) => l.salesOrderLineId === rl.salesOrderLineId);
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
                                        const cc = order.currencyCode || baseCurrency;
                                        return (
                                            <>
                                                <tr className="hidden lg:table-row" style={{ borderTop: '2px solid var(--border)' }}>
                                                    <td colSpan={7} style={{ textAlign: 'right', fontWeight: 600, fontSize: 12, color: 'var(--text-muted)' }}>
                                                        {t('salesOrders.returns.totalCredit')}
                                                    </td>
                                                    <td></td>
                                                    <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
                                                        {formatAmount(subtotal, cc)}
                                                    </td>
                                                    {isRetEditable && <td></td>}
                                                </tr>
                                                <tr className="hidden lg:table-row">
                                                    <td colSpan={7} style={{ textAlign: 'right', fontWeight: 600, fontSize: 12, color: 'var(--text-muted)' }}>
                                                        {tSales('columns.tax')}
                                                    </td>
                                                    <td></td>
                                                    <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
                                                        {formatAmount(totalTax, cc)}
                                                    </td>
                                                    {isRetEditable && <td></td>}
                                                </tr>
                                                <tr className="hidden lg:table-row">
                                                    <td colSpan={7} style={{ textAlign: 'right', fontWeight: 600, fontSize: 12, color: 'var(--text-muted)' }}>
                                                        {t('salesOrders.returns.totalFees')}
                                                    </td>
                                                    <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
                                                        {totalFees > 0 ? `−${formatAmount(totalFees, cc)}` : formatAmount(0, cc)}
                                                    </td>
                                                    <td></td>
                                                    {isRetEditable && <td></td>}
                                                </tr>
                                                <tr className="hidden lg:table-row">
                                                    <td colSpan={7} style={{ textAlign: 'right', fontWeight: 700, fontSize: 13 }}>
                                                        {t('salesOrders.returns.netCredit')}
                                                    </td>
                                                    <td></td>
                                                    <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 700, fontSize: 13 }}>
                                                        {formatAmount(netCredit, cc)}
                                                    </td>
                                                    {isRetEditable && <td></td>}
                                                </tr>
                                                
                                                <tr className="lg:hidden">
                                                    <td colSpan={8} className="py-1 text-xs font-medium text-slate-500 text-right pr-4">{t('salesOrders.returns.totalCredit')}</td>
                                                    <td className="py-1 text-sm font-semibold text-right tabular-nums">{formatAmount(subtotal, cc)}</td>
                                                </tr>
                                                <tr className="lg:hidden">
                                                    <td colSpan={8} className="py-1 text-xs font-medium text-slate-500 text-right pr-4">{tSales('columns.tax')}</td>
                                                    <td className="py-1 text-sm font-semibold text-right tabular-nums">{formatAmount(totalTax, cc)}</td>
                                                </tr>
                                                <tr className="lg:hidden">
                                                    <td colSpan={8} className="py-1 text-xs font-medium text-slate-500 text-right pr-4">{t('salesOrders.returns.totalFees')}</td>
                                                    <td className="py-1 text-sm font-semibold text-right tabular-nums">{totalFees > 0 ? `−${formatAmount(totalFees, cc)}` : formatAmount(0, cc)}</td>
                                                </tr>
                                                <tr className="lg:hidden">
                                                    <td colSpan={8} className="py-2 text-sm font-bold text-[var(--accent)] text-right pr-4">{t('salesOrders.returns.netCredit')}</td>
                                                    <td className="py-2 text-base font-bold text-[var(--accent)] text-right tabular-nums">{formatAmount(netCredit, cc)}</td>
                                                </tr>
                                            </>
                                        );
                                    })()}
                                />
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

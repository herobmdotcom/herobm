'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { apiMutate } from '@/lib/api';
import { formatAmount, HOME_CURRENCY } from '@/lib/currency';
import { computeLinePrice } from '@modbm/shared';

import type { OrderDetail, OrderReturn, GstCategory } from './types';
import {
    RETURN_TRANSITIONS as RETURN_STATE_TRANSITIONS,
    RETURN_LIFECYCLE,
    isBackTransition as sharedIsBackTransition,
} from '@modbm/shared';
import StateBadge, { StateName } from '@/components/StateBadge';
import { ValidState } from '@/types/states';

function ReturnStateBadge({ state }: { state: ValidState }) {
    const t = useTranslations('common.states');
    return <span className={`badge badge-return-${state}`}>{t(state)}</span>;
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
    gstCategories: GstCategory[];
    locations: { locationId: string; name: string }[];
}

export default function ReturnsSection({
    orderId, order, returns, returnsLoading,
    showCreateReturn, setShowCreateReturn,
    setError, loadReturns, loadOrder, pickingSummary, gstCategories, locations,
}: ReturnsSectionProps) {
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
            await apiMutate(`/api/sales-orders/${orderId}/returns`, 'POST', {
                notes: newReturnNotes || undefined,
                lines,
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
                {!showCreateReturn && (
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

                    <table className="table-lines" style={{ marginBottom: 12 }}>
                        <thead>
                            <tr>
                                <th style={{ width: 40 }}>{tSales('columns.lineNumber')}</th>
                                <th>{tSales('columns.product')}</th>
                                <th>{tSales('columns.description')}</th>
                                <th style={{ width: 90, textAlign: 'right' }}>{tSales('columns.shipped')}</th>
                                <th style={{ width: 100, textAlign: 'right' }}>{tSales('columns.returnQty')}</th>
                                <th style={{ width: 180 }}>{tSales('columns.reason')}</th>
                                <th style={{ width: 140, textAlign: 'right' }}>{tSales('columns.fee')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {order.lines.map((line, idx) => {
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
                                            <div className="flex items-center gap-1">
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
                            })}
                            {/* Create form totals */}
                            {(() => {
                                const activeFLines = newReturnLines.filter(l => l.quantityReturned && parseFloat(l.quantityReturned) > 0);
                                if (activeFLines.length === 0) return null;
                                const cc = order.currencyCode || 'AUD';
                                const totalAmount = activeFLines.reduce((sum, rl) => {
                                    const origLine = order.lines.find(l => l.salesOrderLineId === rl.salesOrderLineId);
                                    const unitPrice = parseFloat(origLine?.pricePerUnit || '0');
                                    const disc = parseFloat(origLine?.discountPercentage || '0');
                                    const qty = parseFloat(rl.quantityReturned || '0');
                                    return sum + computeLinePrice({ quantity: qty, pricePerUnit: unitPrice, discountPercentage: disc }).amount;
                                }, 0);
                                const totalFees = activeFLines.reduce((sum, rl) => sum + parseFloat(rl.returnFee || '0'), 0);
                                const netCredit = totalAmount - totalFees;
                                return (
                                    <>
                                        <tr style={{ borderTop: '2px solid var(--border)' }}>
                                            <td colSpan={5} style={{ textAlign: 'right', fontWeight: 600, fontSize: 12, color: 'var(--text-muted)' }}>
                                                {tSales('returns.totalCredit')}
                                            </td>
                                            <td></td>
                                            <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
                                                {formatAmount(totalAmount, cc)}
                                            </td>
                                        </tr>
                                        <tr>
                                            <td colSpan={5} style={{ textAlign: 'right', fontWeight: 600, fontSize: 12, color: 'var(--text-muted)' }}>
                                                {tSales('returns.totalFees')}
                                            </td>
                                            <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
                                                {totalFees > 0 ? `−${formatAmount(totalFees, cc)}` : formatAmount(0, cc)}
                                            </td>
                                            <td></td>
                                        </tr>
                                        <tr>
                                            <td colSpan={5} style={{ textAlign: 'right', fontWeight: 700, fontSize: 13 }}>
                                                {tSales('returns.netCredit')}
                                            </td>
                                            <td></td>
                                            <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 700, fontSize: 13 }}>
                                                {formatAmount(netCredit, cc)}
                                            </td>
                                        </tr>
                                    </>
                                );
                            })()}
                        </tbody>
                    </table>

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
                        const allowedRetTransitions = RETURN_STATE_TRANSITIONS[ret.stateCode] || [];
                        const isRetEditable = ret.stateCode === 'draft';
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
                                        <ReturnStateBadge state={ret.stateCode as ValidState} />
                                        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                                            {new Date(ret.createdOn).toLocaleString()}
                                            {ret.createdBy && ` ${tCommon('by')} ${ret.createdBy}`}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {(ret.stateCode === 'draft' || ret.stateCode === 'received') && (
                                            <select
                                                className="input"
                                                style={{ width: 140, fontSize: 12, padding: '2px 8px', height: 28 }}
                                                value={returnLocations[ret.returnId] !== undefined ? returnLocations[ret.returnId] : (order.fulfillmentLocationId || '')}
                                                onChange={(e) => setReturnLocations({ ...returnLocations, [ret.returnId]: e.target.value })}
                                            >
                                                <option value="">{t('salesOrders.selectLocation')}</option>
                                                {locations.map(loc => (
                                                    <option key={loc.locationId} value={loc.locationId}>{loc.name}</option>
                                                ))}
                                            </select>
                                        )}
                                        <div className="flex gap-2">
                                        {allowedRetTransitions.map((s) => (
                                            <button
                                                key={s}
                                                className={`btn btn-sm ${s === 'cancelled' ? 'btn-danger' : 'btn-primary'}`}
                                                onClick={async () => {
                                                    try {
                                                        await apiMutate(`/api/sales-orders/${orderId}/returns/${ret.returnId}/state`, 'PATCH', {
                                                            stateCode: s,
                                                            locationId: returnLocations[ret.returnId] !== undefined ? returnLocations[ret.returnId] : (order.fulfillmentLocationId || undefined)
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
                                        {ret.stateCode === 'processed' && (
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

                                <table className="table-lines">
                                    <thead>
                                        <tr>
                                            <th>{tSales('columns.product')}</th>
                                            <th style={{ width: 90, textAlign: 'right' }}>{tSales('columns.returnQty')}</th>
                                            <th style={{ textAlign: 'right' }}>{tSales('columns.unitPrice')}</th>
                                            <th style={{ textAlign: 'right' }}>{tSales('columns.discountPct')}</th>
                                            <th style={{ textAlign: 'right' }}>{tSales('columns.gst')}</th>
                                            <th style={{ width: 180 }}>{tSales('columns.reason')}</th>
                                            <th style={{ width: 100, textAlign: 'right' }}>{tSales('columns.fee')}</th>
                                            <th style={{ width: 100, textAlign: 'right' }}>{tSales('columns.amount')}</th>
                                            {isRetEditable && <th style={{ width: 50 }}></th>}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {ret.lines.map((rl) => {
                                            const origLine = order.lines.find((l) => l.salesOrderLineId === rl.salesOrderLineId);
                                            const disc = parseFloat(origLine?.discountPercentage || '0');
                                            const gstCat = gstCategories.find(c => c.gstCategoryId === origLine?.gstCategoryId);
                                            const gstRate = parseFloat(gstCat?.rate || '0');
                                            const cc = order.currencyCode || HOME_CURRENCY.code;
                                            const pricing = computeLinePrice({
                                                quantity: parseFloat(rl.quantityReturned || '0'),
                                                pricePerUnit: parseFloat(origLine?.pricePerUnit || '0'),
                                                discountPercentage: disc,
                                                taxRate: gstRate,
                                            });
                                            return (
                                                <tr key={rl.returnLineId}>
                                                    <td>
                                                        <span style={{ fontWeight: 600, fontSize: 12 }}>
                                                            {origLine?.productNumber || origLine?.productId?.substring(0, 8) || '—'}
                                                        </span>
                                                        <span style={{ marginLeft: 8, fontSize: 12, color: 'var(--text-secondary)' }}>
                                                            {origLine?.productDescription || ''}
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
                                                                            await apiMutate(
                                                                                `/api/sales-orders/${orderId}/returns/${ret.returnId}/lines/${rl.returnLineId}`,
                                                                                'PATCH',
                                                                                { quantityReturned: e.target.value },
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
                                                    <td style={{ textAlign: 'right', color: gstRate > 0 ? 'inherit' : 'var(--text-muted)' }}>
                                                        {gstRate.toFixed(1)}%
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
                                                                            await apiMutate(
                                                                                `/api/sales-orders/${orderId}/returns/${ret.returnId}/lines/${rl.returnLineId}`,
                                                                                'PATCH',
                                                                                { reason: e.target.value },
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
                                                                            await apiMutate(
                                                                                `/api/sales-orders/${orderId}/returns/${ret.returnId}/lines/${rl.returnLineId}`,
                                                                                'PATCH',
                                                                                { returnFee: formatted },
                                                                            );
                                                                            await loadReturns();
                                                                        } catch (err) {
                                                                            setError(err instanceof Error ? err.message : tCommon('errors.failedToUpdateReturnLine'));
                                                                        }
                                                                    }
                                                                }}
                                                            />
                                                        ) : (
                                                            formatAmount(parseFloat(rl.returnFee || '0'), order.currencyCode || HOME_CURRENCY.code)
                                                        )}
                                                    </td>
                                                    <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                                                        {formatAmount(pricing.amount, order.currencyCode || HOME_CURRENCY.code)}
                                                    </td>
                                                    {isRetEditable && (
                                                        <td>
                                                            <button
                                                                className="btn btn-danger btn-sm"
                                                                onClick={async () => {
                                                                    if (!confirm(tConfirm('removeReturnLine'))) return;
                                                                    try {
                                                                        await apiMutate(
                                                                            `/api/sales-orders/${orderId}/returns/${ret.returnId}/lines/${rl.returnLineId}`,
                                                                            'DELETE',
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
                                        })}
                                        {ret.lines.length === 0 && (
                                            <tr>
                                                <td
                                                    colSpan={isRetEditable ? 9 : 8}
                                                    style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '12px 0' }}
                                                >
                                                    {t('salesOrders.noReturnLines')}
                                                </td>
                                            </tr>
                                        )}
                                        {ret.lines.length > 0 && (() => {
                                            const totalAmount = ret.lines.reduce((sum, rl) => {
                                                const origLine = order.lines.find((l) => l.salesOrderLineId === rl.salesOrderLineId);
                                                const unitPrice = parseFloat(origLine?.pricePerUnit || '0');
                                                const disc = parseFloat(origLine?.discountPercentage || '0');
                                                const gstCat = gstCategories.find(c => c.gstCategoryId === origLine?.gstCategoryId);
                                                const gstRate = parseFloat(gstCat?.rate || '0');
                                                const qty = parseFloat(rl.quantityReturned || '0');
                                                return sum + computeLinePrice({ quantity: qty, pricePerUnit: unitPrice, discountPercentage: disc, taxRate: gstRate }).amount;
                                            }, 0);
                                            const totalFees = ret.lines.reduce((sum, rl) => sum + parseFloat(rl.returnFee || '0'), 0);
                                            const totalCredit = totalAmount - totalFees;
                                            const cc = order.currencyCode || HOME_CURRENCY.code;
                                            return (
                                                <>
                                                    <tr style={{ borderTop: '2px solid var(--border)' }}>
                                                        <td colSpan={6} style={{ textAlign: 'right', fontWeight: 600, fontSize: 12, color: 'var(--text-muted)' }}>
                                                            {t('salesOrders.returns.totalCredit')}
                                                        </td>
                                                        <td></td>
                                                        <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
                                                            {formatAmount(totalAmount, cc)}
                                                        </td>
                                                        {isRetEditable && <td></td>}
                                                    </tr>
                                                    <tr>
                                                        <td colSpan={6} style={{ textAlign: 'right', fontWeight: 600, fontSize: 12, color: 'var(--text-muted)' }}>
                                                            {t('salesOrders.returns.totalFees')}
                                                        </td>
                                                        <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
                                                            {totalFees > 0 ? `−${formatAmount(totalFees, cc)}` : formatAmount(0, cc)}
                                                        </td>
                                                        <td></td>
                                                        {isRetEditable && <td></td>}
                                                    </tr>
                                                    <tr>
                                                        <td colSpan={6} style={{ textAlign: 'right', fontWeight: 700, fontSize: 13 }}>
                                                            {t('salesOrders.returns.netCredit')}
                                                        </td>
                                                        <td></td>
                                                        <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 700, fontSize: 13 }}>
                                                            {formatAmount(totalCredit, cc)}
                                                        </td>
                                                        {isRetEditable && <td></td>}
                                                    </tr>
                                                </>
                                            );
                                        })()}
                                    </tbody>
                                </table>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

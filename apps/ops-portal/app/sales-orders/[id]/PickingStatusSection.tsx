'use client';

import { useTranslations } from 'next-intl';
import StateBadge from '@/components/StateBadge';
import { ValidState } from '@/types/states';
import Link from 'next/link';
import { DataTable, MobileCardField } from '@/components/shared/DataTable';

/**
 * PickingStatusSection — Read-only picking status for the Sales Order detail page.
 * Shows picking progress per line (ordered, picked, remaining, on-hand).
 */

interface PickingSummaryLine {
    salesOrderLineId: string;
    lineNumber: number;
    productId: string;
    productNumber: string;
    productDescription: string;
    quantity: string;
    quantityPicked: string;
    quantityShipped: string;
    remaining: string;
    isFullyPicked: boolean;
    isPhysical: boolean;
    onHand: string;
}

interface PickingSummary {
    totalLines: number;
    fullyPickedLines: number;
    isFullyPicked: boolean;
    lines: PickingSummaryLine[];
}

interface Props {
    pickingSummary: PickingSummary | null;
}

export default function PickingStatusSection({ pickingSummary }: Props) {
    const tPicking = useTranslations('picking');
    const tCommon = useTranslations('common');

    if (!pickingSummary) {
        return (
            <div className="text-center py-6 text-sm" style={{ color: 'var(--text-muted)' }}>
                {tCommon('loading')}
            </div>
        );
    }

    const physicalLines = pickingSummary.lines.filter(l => l.isPhysical);
    const fullyPicked = physicalLines.filter(l => l.isFullyPicked).length;

    return (
        <div id="picking-section" className="card">
            <div className="flex items-center justify-between mb-4">
                <h3 className="section-heading">
                    {/* eslint-disable-next-line i18next/no-literal-string */}
                    <span className="material-symbols-outlined">inventory</span>
                    {/* eslint-enable i18next/no-literal-string */}
                    {tPicking('title')}
                </h3>
                <div className="flex items-center gap-2">
                    <span className="bg-[var(--accent)] text-white text-xs font-bold px-2 py-0.5 rounded-full">
                        {fullyPicked} / {physicalLines.length}
                    </span>
                    {pickingSummary.isFullyPicked && (
                        <span className="text-xs font-bold text-[var(--success)]">
                            {/* eslint-disable-next-line i18next/no-literal-string */}
                            <span className="material-symbols-outlined text-sm align-middle mr-0.5">check_circle</span>
                            {/* eslint-enable i18next/no-literal-string */}
                            {tPicking('statuses.done')}
                        </span>
                    )}
                </div>
            </div>

            <DataTable
                data={physicalLines}
                keyExtractor={(line) => line.salesOrderLineId}
                columns={[
                    { header: tPicking('columns.product') },
                    { header: tPicking('columns.ordered'), align: 'right' },
                    { header: tPicking('columns.picked'), align: 'right' },
                    { header: tPicking('columns.remaining'), align: 'right' },
                    { header: tPicking('columns.onHand'), align: 'right' },
                    { header: tPicking('columns.status'), align: 'center' }
                ]}
                emptyMessage={tPicking('noPhysicalLines')}
                renderCustomRow={(line) => {
                    const remaining = parseFloat(line.remaining);
                    return (
                        <tr key={line.salesOrderLineId} className={line.isFullyPicked ? 'opacity-60' : ''}>
                            <td>
                                <div className="font-bold text-sm">
                                    {line.productId ? (
                                        <Link href={`/products/${line.productId}`} style={{ color: 'var(--accent)', textDecoration: 'none' }}>
                                            {line.productNumber}
                                        </Link>
                                    ) : line.productNumber}
                                </div>
                                <div className="text-xs text-[var(--text-muted)] truncate max-w-[250px]">{line.productDescription}</div>
                            </td>
                            <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                                {parseFloat(line.quantity).toLocaleString()}
                            </td>
                            <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                                {parseFloat(line.quantityPicked).toLocaleString()}
                            </td>
                            <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                                <span className={remaining > 0 ? 'font-semibold text-[var(--warning)]' : 'text-[var(--text-muted)]'}>
                                    {remaining.toLocaleString()}
                                </span>
                            </td>
                            <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                                {parseFloat(line.onHand).toLocaleString()}
                            </td>
                            <td style={{ textAlign: 'center' }}>
                                {line.isFullyPicked ? (
                                    <>
                                        {/* eslint-disable-next-line i18next/no-literal-string */}
                                        <span className="material-symbols-outlined text-[var(--success)] text-base" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                                        {/* eslint-enable i18next/no-literal-string */}
                                    </>
                                ) : remaining > 0 ? (
                                    <>
                                        {/* eslint-disable-next-line i18next/no-literal-string */}
                                        <span className="material-symbols-outlined text-[var(--warning)] text-base">pending</span>
                                        {/* eslint-enable i18next/no-literal-string */}
                                    </>
                                ) : null}
                            </td>
                        </tr>
                    );
                }}
                mobileCard={(line) => {
                    const remaining = parseFloat(line.remaining);
                    return (
                        <div className={`bg-[var(--bg-card)] rounded-xl border border-[var(--border)] p-4 flex flex-col ${line.isFullyPicked ? 'opacity-60' : ''}`}>
                            <div className="flex justify-between items-start gap-2 mb-2">
                                <div className="font-semibold text-sm text-[var(--accent)]">
                                    {line.productId ? (
                                        <Link href={`/products/${line.productId}`} style={{ color: 'var(--accent)', textDecoration: 'none' }}>
                                            {line.productNumber}
                                        </Link>
                                    ) : line.productNumber}
                                </div>
                                <div>
                                    {line.isFullyPicked ? (
                                        <span className="material-symbols-outlined text-[var(--success)] text-base" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                                    ) : remaining > 0 ? (
                                        <span className="material-symbols-outlined text-[var(--warning)] text-base">pending</span>
                                    ) : null}
                                </div>
                            </div>
                            <div className="text-sm text-slate-600 font-medium mb-3">
                                {line.productDescription}
                            </div>
                            
                            <div className="flex flex-col gap-0 border-t border-slate-100 pt-1">
                                <MobileCardField label={tPicking('columns.ordered')} value={
                                    <span className="font-semibold">{parseFloat(line.quantity).toLocaleString()}</span>
                                } />
                                <MobileCardField label={tPicking('columns.picked')} value={
                                    <span>{parseFloat(line.quantityPicked).toLocaleString()}</span>
                                } />
                                <MobileCardField label={tPicking('columns.remaining')} value={
                                    <span className={remaining > 0 ? 'font-semibold text-[var(--warning)]' : 'text-[var(--text-muted)]'}>
                                        {remaining.toLocaleString()}
                                    </span>
                                } />
                                <MobileCardField label={tPicking('columns.onHand')} value={
                                    <span>{parseFloat(line.onHand).toLocaleString()}</span>
                                } />
                            </div>
                        </div>
                    );
                }}
            />
        </div>
    );
}

'use client';

import React, { useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import DataGrid from '@/components/DataGrid';
import { apiMutate } from '@/lib/api';
import Link from 'next/link';
import POLineSearchInput from '@/components/shared/POLineSearchInput';

export default function GoodsReceivedListPage() {
    const t = useTranslations('goodsReceived');
    const tCommon = useTranslations('common');
    useDocumentTitle(t('title'));
    const [days, setDays] = useState('90');
    // Force grid refresh by toggling this key
    const [refreshKey, setRefreshKey] = useState(0);

    const gridEndpoint = `/api/goods-received/lines?days=${days}&limit=0`;

    const POAllocationCell = (params: any) => {
        const { data } = params;
        const [isResolving, setIsResolving] = useState(false);
        const [poLineId, setPoLineId] = useState('');

        if (!data) return null;

        const handleUnresolve = async () => {
            if (!confirm('Are you sure you want to change this allocation?')) return;
            try {
                await apiMutate(`/api/goods-received/lines/${data.goodsReceivedLineId}/unresolve`, 'POST');
                setRefreshKey(k => k + 1);
            } catch (err: any) {
                alert(err.message || 'Failed to unresolve allocation');
            }
        };

        if (data.matchStatus === 'matched') {
            return (
                <div className="flex items-center justify-start gap-2 h-full w-full">
                    <span style={{ fontWeight: 500 }}>{data.orderNumber}</span>
                    <span className="badge badge-success">{data.matchStatus}</span>
                    <button
                        onClick={handleUnresolve}
                        className="btn btn-secondary btn-sm"
                        style={{ padding: '0 6px', height: 22, fontSize: 11, marginLeft: 8 }}
                        title="Change Allocation"
                    >
                        {/* eslint-disable-next-line i18next/no-literal-string */}
                        Change
                    </button>
                </div>
            );
        }

        const handleResolve = async () => {
            if (!poLineId) {
                alert('Please select a PO Line');
                return;
            }
            try {
                await apiMutate(`/api/goods-received/lines/${data.goodsReceivedLineId}/resolve`, 'POST', {
                    purchaseOrderLineId: poLineId,
                });
                setIsResolving(false);
                setRefreshKey(k => k + 1);
            } catch (err: any) {
                alert(err.message || 'Failed to resolve allocation');
            }
        };

        if (isResolving) {
            return (
                <div className="flex items-center gap-2 h-full">
                    <div style={{ width: 180 }}>
                        <POLineSearchInput
                            productId={data.productId}
                            vendorId={data.vendorId}
                            onSelect={(id) => {
                                setPoLineId(id);
                            }}
                            placeholder="Find PO..."
                        />
                    </div>
                    {poLineId && (
                        <button
                            onClick={handleResolve}
                            className="btn btn-primary btn-sm"
                            style={{ padding: '0 6px', height: 26, fontSize: 11 }}
                        >
                            {tCommon('save')}
                        </button>
                    )}
                    <button
                        onClick={() => {
                            setIsResolving(false);
                            setPoLineId('');
                        }}
                        className="btn btn-secondary btn-sm"
                        style={{ padding: '0 6px', height: 26, fontSize: 11 }}
                    >
                        {/* eslint-disable-next-line i18next/no-literal-string */}
                        ✕
                    </button>
                </div>
            );
        }

        return (
            <div className="flex items-center justify-start w-full h-full">
                <button
                    onClick={() => setIsResolving(true)}
                    className="btn btn-secondary btn-sm"
                    style={{ padding: '0 8px', height: 24, fontSize: 11 }}
                >
                    {/* eslint-disable-next-line i18next/no-literal-string */}
                    Allocate
                </button>
            </div>
        );
    };
    
    const gridColumns: any[] = [
        { field: 'goodsReceivedLineId', headerName: tCommon('columns.id'), hide: true },
        { field: 'receiptNumber', headerName: t('columns.receiptNo'), width: 140 },
        { field: 'createdOn', headerName: tCommon('columns.date'), width: 110, valueFormatter: (p: any) => p.value ? new Date(p.value).toLocaleDateString() : '' },
        { field: 'vendorName', headerName: t('columns.supplier'), width: 160 },
        { 
            field: 'productNumber', 
            headerName: tCommon('columns.product'), 
            width: 240,
            cellRenderer: (p: any) => {
                if (!p.data) return null;
                return (
                    <div style={{ lineHeight: '1.2', padding: '4px 0' }}>
                        <div style={{ fontWeight: 600, color: 'var(--accent)' }}>{p.data.productNumber}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{p.data.productName}</div>
                    </div>
                );
            }
        },
        { 
            field: 'quantityReceived', 
            headerName: tCommon('columns.quantity'), 
            width: 90,
            cellStyle: { textAlign: 'right', fontVariantNumeric: 'tabular-nums' }
        },
        {
            field: 'orderNumber',
            headerName: 'PO Allocation',
            width: 320,
            cellRenderer: POAllocationCell
        },
        { field: 'packingSlipNumber', headerName: t('columns.packingSlip'), width: 140 },
        { field: 'notes', headerName: tCommon('columns.notes'), flex: 1, minWidth: 200 }
    ];

    return (
        <>
            <div className="h-full flex flex-col relative p-4 lg:p-6">
                <div className="flex-1 min-h-0 flex flex-col z-10 bg-white rounded-xl shadow-sm border border-[rgba(196,198,205,0.4)] overflow-hidden transition-all">
                    <DataGrid 
                        key={refreshKey}
                        endpoint={gridEndpoint} 
                        columns={gridColumns} 
                        gridKey="goods-received-lines-list"
                        fetchAll
                        rowIdField="goodsReceivedLineId"
                        renderHeader={({ searchInput, optionsButton, rowCount, loading }) => (
                            <div className="flex items-center justify-between px-6 py-4">
                                <div className="flex items-center gap-4 flex-1">
                                    {/* eslint-disable-next-line i18next/no-literal-string */}
                                    <h2 className="text-[1.3rem] font-bold tracking-tight text-[#041627] shrink-0" style={{ fontFamily: 'Manrope, sans-serif' }}>
                                        {t('title')} (Lines)
                                    </h2>
                                    <div className="h-5 w-px bg-[rgba(196,198,205,0.4)] shrink-0 mx-2"></div>
                                    <div className="flex items-center gap-2 px-3 py-1.5 bg-[#f2f4f6] rounded-lg shrink-0">
                                        <span className="text-[11px] font-bold text-[#041627] tracking-wider uppercase" style={{ fontFamily: 'Manrope, sans-serif' }}>
                                            {tCommon('grid.rowCountLabel')}
                                        </span>
                                        <span className="text-[11px] font-bold text-[#006b5c]">
                                            {loading ? '...' : rowCount.toLocaleString()}
                                        </span>
                                    </div>
                                    
                                    <div className="flex-1 ml-4 max-w-md">
                                        {searchInput}
                                    </div>
                                </div>
                                
                                <div className="flex items-center gap-3 shrink-0 ml-4">
                                    <select
                                        value={days}
                                        onChange={(e) => setDays(e.target.value)}
                                        className="input text-sm"
                                        style={{ minWidth: 150 }}
                                    >
                                        <option value="30">{tCommon('filters.last30Days')}</option>
                                        <option value="90">{tCommon('filters.last90Days')}</option>
                                        <option value="365">{tCommon('filters.last1Year')}</option>
                                        <option value="0">{tCommon('filters.allTime')}</option>
                                    </select>
                                    {optionsButton}
                                    <Link href="/receiving/new" className="px-4 py-2 text-sm font-bold rounded-lg transition-all bg-[#006b5c] text-white hover:brightness-110 whitespace-nowrap">
                                      {t('buttons.newReception')}
                                    </Link>
                                </div>
                            </div>
                        )}
                    />
                </div>
            </div>
        </>
    );
}

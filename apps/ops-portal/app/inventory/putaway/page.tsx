'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import Link from 'next/link';

import { reportError } from '@/lib/api';
import * as api from '@modbm/sdk';
import { useSettings } from '@/components/SettingsProvider';
import { PUTAWAY_STATUS } from '@modbm/shared';

interface PutawayLine {
    id: string;
    sourceType: 'goods_receipt' | 'sales_return';
    referenceNumber: string;
    productId: string;
    productName: string;
    quantity: string;
    createdOn: string;
}

interface BinInfo {
    binId: string;
    binNumber: string;
    binType: string;
}

interface PutawayContext {
    primaryBinId: string | null;
    primaryBinNumber: string | null;
    currentQuantity: number;
    availableBins: BinInfo[];
}

export default function PutawayPage() {
    const t = useTranslations('inventory');
    const tCommon = useTranslations('common');
    useDocumentTitle(t('putaway.title'));
    const { app } = useSettings();

    const [locations, setLocations] = useState<any[]>([]);
    const [selectedLocationId, setSelectedLocationId] = useState<string>('');
    const [pendingLines, setPendingLines] = useState<PutawayLine[]>([]);
    const [selectedLine, setSelectedLine] = useState<PutawayLine | null>(null);
    const [loadingLines, setLoadingLines] = useState(false);
    
    // Putaway Form State
    const [context, setContext] = useState<PutawayContext | null>(null);
    const [loadingContext, setLoadingContext] = useState(false);
    const [selectedBinId, setSelectedBinId] = useState<string>('');
    const [binSearch, setBinSearch] = useState<string>('');
    const [newTotalQuantity, setNewTotalQuantity] = useState<string>('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Fetch Locations
    useEffect(() => {
        api.inventoryControllerFindAllLocations({} as any)
            .then((response) => {
                const res = response.data as any;
                const locs = res.data || res || [];
                setLocations(locs);
                if (locs.length > 0) {
                    const defaultLocId = app?.defaultFulfillmentLocationId || locs[0].locationId;
                    setSelectedLocationId(defaultLocId);
                }
            })
            .catch(err => reportError(err, 'Failed to load locations'));
    }, [app?.defaultFulfillmentLocationId]);

    // Fetch Pending Lines
    useEffect(() => {
        if (!selectedLocationId) return;

        setLoadingLines(true);
        setSelectedLine(null);
        setContext(null);

        api.inventoryControllerGetPendingPutaway({ locationId: selectedLocationId })
            .then(response => {
                const data = response.data as any;
                setPendingLines(data.data || data || []);
            })
            .catch(err => reportError(err, 'Failed to load pending lines'))
            .finally(() => setLoadingLines(false));
    }, [selectedLocationId]);

    // Fetch Context for Selected Line
    useEffect(() => {
        if (!selectedLine || !selectedLocationId) {
            setContext(null);
            return;
        }

        setLoadingContext(true);
        setError(null);
        api.inventoryControllerGetPutawayContext({ productId: selectedLine.productId, locationId: selectedLocationId })
            .then((response) => {
                const data = response.data as any;
                const contextData = data.data || data;
                setContext(contextData);
                if (contextData.primaryBinId) {
                    setSelectedBinId(contextData.primaryBinId);
                    setBinSearch(contextData.primaryBinNumber || '');
                } else {
                    setSelectedBinId('');
                    setBinSearch('');
                }
                const expectedTotal = contextData.currentQuantity + parseFloat(selectedLine.quantity);
                setNewTotalQuantity(expectedTotal.toString());
            })
            .catch(err => setError(err.message))
            .finally(() => setLoadingContext(false));
    }, [selectedLine, selectedLocationId]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedLine || !selectedBinId || !newTotalQuantity) return;

        setIsSubmitting(true);
        setError(null);

        try {
            await api.inventoryControllerPutaway({
                putaways: [
                    {
                        lineId: selectedLine.id,
                        sourceType: selectedLine.sourceType,
                        destinationBinId: selectedBinId,
                        quantity: selectedLine.quantity,
                        newTotalQuantity
                    }
                ]
            });

            // Remove from list and reset
            setPendingLines(prev => prev.filter(l => l.id !== selectedLine.id));
            setSelectedLine(null);
            setContext(null);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="h-full flex flex-col p-4 lg:p-6 bg-[var(--bg-primary)]">
            <div className="flex items-center justify-between mb-4 shrink-0">
                <div className="flex items-center gap-4">
                    <h1 className="text-2xl font-bold tracking-tight text-[var(--text-primary)]" style={{ fontFamily: 'Manrope, sans-serif' }}>
                        {t('putaway.title')}
                    </h1>
                </div>

                <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold text-[var(--text-muted)]">{tCommon('location')}:</span>
                    <select
                        value={selectedLocationId}
                        onChange={(e) => setSelectedLocationId(e.target.value)}
                        className="input text-sm w-48"
                    >
                        {locations.map(loc => (
                            <option key={loc.locationId} value={loc.locationId}>
                                {loc.code} - {loc.name}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            <div className="flex-1 min-h-0 flex gap-6">
                {/* Left Pane: List */}
                <div className="w-1/2 flex flex-col bg-[var(--bg-card)] border border-[var(--border)] rounded-xl shadow-sm overflow-hidden">
                    <div className="px-4 py-3 border-b border-[var(--border)] bg-[var(--bg-secondary)] flex justify-between items-center">
                        <h2 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-wider">{t('putaway.pendingPutaway')}</h2>
                        <span className="bg-[var(--accent)] text-white text-xs font-bold px-2 py-0.5 rounded-full">
                            {pendingLines.length}
                        </span>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto p-2">
                        {loadingLines ? (
                            <div className="flex items-center justify-center h-full text-[var(--text-muted)] text-sm">
                                {tCommon('loading')}
                            </div>
                        ) : pendingLines.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full text-[var(--text-muted)] text-sm p-8 text-center">
                                {/* eslint-disable i18next/no-literal-string */}
                                <span className="material-symbols-outlined text-4xl mb-2 opacity-50">inventory_2</span>
                                {/* eslint-enable i18next/no-literal-string */}
                                {t('putaway.noItemsPending')}
                            </div>
                        ) : (
                            <div className="flex flex-col gap-2">
                                {pendingLines.map(line => (
                                    <div 
                                        key={line.id}
                                        onClick={() => setSelectedLine(line)}
                                        className={`p-3 rounded-lg border cursor-pointer transition-colors ${selectedLine?.id === line.id ? 'bg-[var(--bg-secondary-hover)] border-[var(--accent)]' : 'border-[var(--border)] hover:bg-[var(--bg-card-hover)]'}`}
                                    >
                                        <div className="flex justify-between items-start mb-1">
                                            <div className="font-bold text-[var(--text-primary)] text-sm">{line.productName}</div>
                                            <div className="font-bold text-[var(--text-primary)] text-sm">{parseFloat(line.quantity).toLocaleString()}</div>
                                        </div>
                                        <div className="flex items-center justify-between text-[11px] text-[var(--text-secondary)]">
                                            <span>
                                                {line.sourceType === 'sales_return' ? (
                                                    <span className="font-bold mr-2">{t('putaway.return')}</span>
                                                ) : (
                                                    <span className="font-bold mr-2">{t('putaway.receipt')}</span>
                                                )}
                                                {t('putaway.ref', { ref: line.referenceNumber })}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Pane: Action Form */}
                <div className="w-1/2 flex flex-col bg-[var(--bg-card)] border border-[var(--border)] rounded-xl shadow-sm overflow-hidden">
                    <div className="px-4 py-3 border-b border-[var(--border)] bg-[var(--bg-secondary)]">
                        <h2 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-wider">{t('putaway.action')}</h2>
                    </div>

                    <div className="flex-1 overflow-y-auto p-6">
                        {!selectedLine ? (
                            <div className="flex items-center justify-center h-full text-[var(--text-muted)] text-sm">
                                {t('putaway.selectItemToPutaway')}
                            </div>
                        ) : loadingContext ? (
                            <div className="flex items-center justify-center h-full text-[var(--text-muted)] text-sm">
                                {t('putaway.loadingBinContext')}
                            </div>
                        ) : context ? (
                            <form onSubmit={handleSubmit} className="flex flex-col h-full max-w-md mx-auto">
                                <div className="mb-6 pb-4 border-b border-[var(--border)] flex justify-between items-start">
                                    <div>
                                        <h3 className="text-lg font-bold text-[var(--accent)]">{selectedLine.productName}</h3>
                                        <p className="text-sm text-[var(--text-secondary)] mt-1">{t('putaway.ref', { ref: selectedLine.referenceNumber })}</p>
                                    </div>
                                    <div className="text-2xl font-bold text-[var(--text-primary)] mt-1">
                                        {parseFloat(selectedLine.quantity).toLocaleString()}
                                    </div>
                                </div>

                                {error && (
                                    <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-md flex items-center gap-2">
                                        {/* eslint-disable i18next/no-literal-string */}
                                        <span className="material-symbols-outlined text-sm">error</span>
                                        {/* eslint-enable i18next/no-literal-string */}
                                        {error}
                                    </div>
                                )}

                                <div className="space-y-5 flex-1">
                                    <div>
                                        <label className="block text-xs font-bold text-[var(--text-muted)] uppercase mb-1.5">{t('putaway.destinationBin')}</label>
                                        <input
                                            type="text"
                                            list="available-bins"
                                            value={binSearch}
                                            onChange={e => {
                                                const val = e.target.value;
                                                setBinSearch(val);
                                                const match = context.availableBins.find(b => b.binNumber === val);
                                                setSelectedBinId(match ? match.binId : '');
                                            }}
                                            className="w-full px-3 py-2 border border-[var(--border)] rounded-md bg-[var(--bg-card)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)] text-sm"
                                            placeholder={t('putaway.searchBins')}
                                            required
                                        />
                                        <datalist id="available-bins">
                                            {context.availableBins.map(bin => (
                                                <option key={bin.binId} value={bin.binNumber}>
                                                    {bin.binId === context.primaryBinId ? t('putaway.primaryLabel') : ''}
                                                </option>
                                            ))}
                                        </datalist>
                                        
                                        {/* Tiles UI */}
                                        {(() => {
                                            const matchingBins = context.availableBins.filter(b => b.binNumber.toUpperCase().startsWith(binSearch.toUpperCase()));
                                            const showTiles = !selectedBinId;
                                            
                                            let tiles: { label: string; value: string; isFullBin: boolean; binId?: string }[] = [];
                                            if (showTiles) {
                                                if (matchingBins.length < 20) {
                                                    tiles = matchingBins.map(b => ({
                                                        label: b.binNumber,
                                                        value: b.binNumber,
                                                        isFullBin: true,
                                                        binId: b.binId
                                                    }));
                                                } else {
                                                    const nextCharIndex = binSearch.length;
                                                    const prefixSet = new Set<string>();
                                                    matchingBins.forEach(b => {
                                                        if (b.binNumber.length > nextCharIndex) {
                                                            prefixSet.add(b.binNumber.substring(0, nextCharIndex + 1).toUpperCase());
                                                        } else {
                                                            prefixSet.add(b.binNumber.toUpperCase());
                                                        }
                                                    });
                                                    tiles = Array.from(prefixSet).sort().map(prefix => {
                                                        return { label: prefix, value: prefix, isFullBin: false };
                                                    });
                                                }
                                            }

                                            if (!showTiles || tiles.length === 0) return null;

                                            return (
                                                <div className="mt-3">
                                                    <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
                                                        {tiles.map(tile => (
                                                            <button
                                                                key={tile.value}
                                                                type="button"
                                                                onClick={() => {
                                                                    setBinSearch(tile.value);
                                                                    if (tile.isFullBin && tile.binId) {
                                                                        setSelectedBinId(tile.binId);
                                                                    }
                                                                }}
                                                                className="h-14 px-1 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg flex items-center justify-center text-sm font-bold text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)] hover:border-[var(--accent)] transition-all truncate"
                                                                title={tile.label}
                                                            >
                                                                {tile.label}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                            );
                                        })()}

                                        {context.primaryBinId && selectedBinId && selectedBinId !== context.primaryBinId && (
                                            <p className="mt-2 text-[11px] text-[var(--warning)] flex items-center gap-1">
                                                {/* eslint-disable i18next/no-literal-string */}
                                                <span className="material-symbols-outlined text-[14px]">warning</span>
                                                {/* eslint-enable i18next/no-literal-string */}
                                                {t('putaway.warningNotPrimary', { bin: context.primaryBinNumber || '' })}
                                            </p>
                                        )}
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-[var(--text-muted)] uppercase mb-1.5 flex justify-between">
                                            <span>{t('putaway.newTotalQuantity')}</span>
                                            <span className="text-[10px] font-normal normal-case">{t('putaway.currentStock', { count: context.currentQuantity })}</span>
                                        </label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            value={newTotalQuantity}
                                            onChange={e => setNewTotalQuantity(e.target.value)}
                                            className="w-full px-3 py-2 border border-[var(--border)] rounded-md bg-[var(--bg-card)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)] text-sm"
                                            required
                                        />
                                        <p className="mt-1 text-[11px] text-[var(--text-muted)]">
                                            {t('putaway.verifyCountDescription')}
                                        </p>
                                    </div>
                                </div>

                                <div className="pt-4 mt-auto">
                                    <button
                                        type="submit"
                                        disabled={isSubmitting || !selectedBinId || !newTotalQuantity}
                                        className="w-full py-2.5 px-4 bg-[var(--accent)] text-white text-sm font-bold rounded-lg hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm flex items-center justify-center gap-2"
                                    >
                                        {isSubmitting ? (
                                            <>
                                                {/* eslint-disable i18next/no-literal-string */}
                                                <span className="material-symbols-outlined animate-spin text-[18px]">sync</span>
                                                {/* eslint-enable i18next/no-literal-string */}
                                                {t('putaway.processing')}
                                            </>
                                        ) : (
                                            <>
                                                {/* eslint-disable i18next/no-literal-string */}
                                                <span className="material-symbols-outlined text-[18px]">done_all</span>
                                                {/* eslint-enable i18next/no-literal-string */}
                                                {t('putaway.confirmPutaway')}
                                            </>
                                        )}
                                    </button>
                                </div>
                            </form>
                        ) : null}
                    </div>
                </div>
            </div>
        </div>
    );
}

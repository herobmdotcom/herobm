'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import Link from 'next/link';
import { Button } from '@/components/shared/Button';

import { reportError } from '@/lib/api';
import * as api from '@herobm/sdk';
import { useSettings } from '@/components/SettingsProvider';
import { PUTAWAY_STATUS } from '@herobm/shared';
import SlideOver from '@/components/shared/SlideOver';
import MasterDetailLayout from '@/components/shared/MasterDetailLayout';
import InlineAlert from '@/components/shared/InlineAlert';
import { getErrorMessage, BIN_TYPE } from '@herobm/shared';
import { usePersistedSetting } from '@/hooks/usePersistedSetting';

interface PutawayLine {
    id: string;
    sourceType: 'goods_receipt' | 'sales_return' | 'transfer_receipt' | 'work_order';
    referenceNumber: string;
    productId: string;
    productName: string;
    productNumber: string;
    quantity: string;
    createdOn: string;
}

interface BinInfo {
    binId: string;
    binNumber: string;
    binType: string;
    zoneCode?: string;
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

    const [locations, setLocations] = useState<api.InventoryLocationResponseDto[]>([]);
    const [selectedLocationId, setSelectedLocationId] = useState<string>('');
    const [pendingLines, setPendingLines] = useState<PutawayLine[]>([]);
    const [selectedLine, setSelectedLine] = useState<PutawayLine | null>(null);
    const [loadingLines, setLoadingLines] = useState(false);
    const [selectedZone, setSelectedZone] = usePersistedSetting('putaway_selected_zone', '');
    
    // Putaway Form State
    const [context, setContext] = useState<PutawayContext | null>(null);
    const [loadingContext, setLoadingContext] = useState(false);
    const [selectedBinId, setSelectedBinId] = useState<string>('');
    const [binSearch, setBinSearch] = useState<string>('');
    const [newTotalQuantity, setNewTotalQuantity] = useState<string>('');
    const [quarantineReason, setQuarantineReason] = useState<string>('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const isQuarantineBin = context?.availableBins.find(b => b.binId === selectedBinId)?.binType === BIN_TYPE.QUARANTINE;

    // Fetch Locations
    useEffect(() => {
        api.inventoryControllerFindAllLocations({} )
            .then((response) => {
                const res = response.data;
                const locs = res || [];
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
                const lines = response.data || [];
                setPendingLines(lines.map(l => ({ ...l, id: l.putawayId })) as unknown as PutawayLine[]);
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
                const contextData = response.data ;
                setContext(contextData as unknown as PutawayContext);
                if (contextData.primaryBinId) {
                    setSelectedBinId(contextData.primaryBinId);
                    setBinSearch(contextData.primaryBinNumber || '');
                    const primaryBin = (contextData.availableBins as BinInfo[]).find(b => b.binId === contextData.primaryBinId);
                    if (primaryBin?.zoneCode) {
                        setSelectedZone(primaryBin.zoneCode);
                    }
                } else {
                    setSelectedBinId('');
                    setBinSearch('');
                    const uniqueZones = Array.from(new Set((contextData.availableBins as BinInfo[]).map(b => b.zoneCode).filter(Boolean))) as string[];
                    if (uniqueZones.length > 0) {
                        // We check if current selectedZone is valid. Since selectedZone might be stale in this closure, 
                        // we can just let React handle it via another effect, or just set it if it's currently empty.
                        // However, we can just do it here. If the persisted zone isn't in uniqueZones, it's safer to just set to first.
                        setSelectedZone(prev => (!prev || !uniqueZones.includes(prev)) ? uniqueZones.sort()[0] : prev);
                    }
                }
                const expectedTotal = contextData.currentQuantity + parseFloat(selectedLine.quantity);
                setNewTotalQuantity(expectedTotal.toString());
            })
            .catch(err => setError(getErrorMessage(err)))
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
                        sourceType: selectedLine.sourceType as "goods_receipt" | "sales_return",
                        destinationBinId: selectedBinId,
                        quantity: selectedLine.quantity,
                        newTotalQuantity,
                        ...(isQuarantineBin && quarantineReason ? { reason: quarantineReason } : {})
                    }
                ]
            });

            // Remove from list and reset
            setPendingLines(prev => prev.filter(l => l.id !== selectedLine.id));
            setSelectedLine(null);
            setContext(null);
            setQuarantineReason('');
        } catch (err: unknown) {
            setError(getErrorMessage(err));
        } finally {
            setIsSubmitting(false);
        }
    };

    const actionFormContent = (
        <div className="flex-1 overflow-y-auto p-3 lg:p-4 pb-20 lg:pb-4">
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
                    {error && (
                        <div className="mb-4">
                            <InlineAlert type="error" message={error} />
                        </div>
                    )}

                    <div className="space-y-4 flex-1">
                        {(() => {
                            const uniqueZones = Array.from(new Set(context.availableBins.map(b => b.zoneCode).filter(Boolean))) as string[];
                            if (uniqueZones.length === 0) return null;
                            return (
                                <div>
                                    <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
                                        {uniqueZones.sort().map(zone => (
                                            <Button variant="ghost"
                                                key={zone}
                                                type="button"
                                                onClick={() => {
                                                    setSelectedZone(zone);
                                                    setBinSearch('');
                                                    setSelectedBinId('');
                                                }}
                                                className={`h-10 px-2 rounded-md font-bold text-sm transition-all flex items-center justify-center truncate ${selectedZone === zone ? 'bg-[var(--accent)] text-white shadow-md' : 'bg-[var(--bg-secondary)] text-[var(--text-primary)] border border-[var(--border)] hover:bg-[var(--bg-secondary-hover)]'}`}
                                            >
                                                {zone}
                                            </Button>
                                        ))}
                                    </div>
                                </div>
                            );
                        })()}

                        <div>
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
                                {context.availableBins.filter(b => !selectedZone || b.zoneCode === selectedZone).map(bin => (
                                    <option key={bin.binId} value={bin.binNumber}>
                                        {bin.binId === context.primaryBinId ? t('putaway.primaryLabel') : ''}
                                    </option>
                                ))}
                            </datalist>
                            
                            {/* Tiles UI */}
                            {(() => {
                                const matchingBins = context.availableBins.filter(b => {
                                    if (selectedZone && b.zoneCode !== selectedZone) return false;
                                    return b.binNumber.toUpperCase().startsWith(binSearch.toUpperCase());
                                });
                                
                                let tiles: { label: string; value: string; isFullBin: boolean; binId?: string }[] = [];
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

                                if (tiles.length === 0) return null;

                                const showClearBtn = binSearch.length > 0 || selectedBinId;

                                return (
                                    <div className="mt-3">
                                        <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
                                            {tiles.map(tile => {
                                                const isSelected = tile.isFullBin && tile.binId === selectedBinId;
                                                return (
                                                    <Button variant="ghost"
                                                        key={tile.value}
                                                        type="button"
                                                        onClick={() => {
                                                            setBinSearch(tile.value);
                                                            if (tile.isFullBin && tile.binId) {
                                                                setSelectedBinId(tile.binId);
                                                            }
                                                        }}
                                                        className={`h-14 px-1 rounded-lg flex items-center justify-center text-sm font-bold transition-all truncate border ${isSelected ? 'bg-[var(--accent)] text-white border-[var(--accent)]' : 'bg-[var(--bg-secondary)] border-[var(--border)] text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)] hover:border-[var(--accent)]'}`}
                                                        title={tile.label}
                                                    >
                                                        {tile.label}
                                                    </Button>
                                                );
                                            })}
                                            {showClearBtn && (
                                                <Button variant="ghost"
                                                    type="button"
                                                    onClick={() => {
                                                        setBinSearch('');
                                                        setSelectedBinId('');
                                                    }}
                                                    className="h-14 px-1 border border-gray-300 rounded-lg flex items-center justify-center text-sm font-bold transition-all bg-white text-black hover:bg-gray-100"
                                                    title="Clear filter"
                                                >
                                                    {/* eslint-disable-next-line i18next/no-literal-string -- Material UI Icon */}
                                                    <span className="material-symbols-outlined text-[20px]">close</span>
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                );
                            })()}

                            {context.primaryBinId && selectedBinId && selectedBinId !== context.primaryBinId && (
                                <p className="mt-2 text-[11px] text-[var(--warning)] flex items-center gap-1">
                                    {/* eslint-disable-next-line i18next/no-literal-string -- Hardcoded string exceptions for standard system IDs, technical constants, or non-translatable symbols (e.g., -- Material UI Icon). */}
                                    <span className="material-symbols-outlined text-[14px]">warning</span>
                                    {t('putaway.warningNotPrimary', { bin: context.primaryBinNumber || '' })}
                                </p>
                            )}
                            
                            {isQuarantineBin && (
                                <div className="mt-3 p-3 border border-[var(--warning)] bg-[#fffbea] dark:bg-[#2b2200] rounded-md">
                                    <p className="text-xs font-bold text-[var(--warning)] flex items-center gap-1 mb-2">
                                        <span className="material-symbols-outlined text-[16px]">health_and_safety</span>
                                        Quarantine Hold
                                    </p>
                                    <label className="block text-xs text-[var(--text-secondary)] mb-1">Reason for quarantine (optional)</label>
                                    <textarea
                                        value={quarantineReason}
                                        onChange={e => setQuarantineReason(e.target.value)}
                                        className="w-full px-3 py-2 border border-[var(--border)] rounded-md bg-[var(--bg-card)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--warning)] text-sm resize-none"
                                        rows={2}
                                        placeholder="e.g. Scratched during transit, missing components..."
                                    />
                                </div>
                            )}
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-[var(--text-muted)] mb-1.5 flex justify-between">
                                <span>New Total Quantity in Bin (To Verify)</span>
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
                        </div>
                    </div>

                    <div className="pt-4 mt-auto">
                        <Button variant="primary"
                            type="submit"
                            disabled={isSubmitting || !selectedBinId || !newTotalQuantity}
                            className="w-full py-2.5 px-4 bg-[var(--accent)] text-white text-sm font-bold rounded-lg hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                        >
                            {isSubmitting ? (
                                <>
                                    {/* eslint-disable-next-line i18next/no-literal-string -- Hardcoded string exceptions for standard system IDs, technical constants, or non-translatable symbols (e.g., -- Material UI Icon). */}
                                    <span className="material-symbols-outlined animate-spin text-[18px]">sync</span>
                                    {t('putaway.processing')}
                                </>
                            ) : (
                                <>
                                    { }
                                    <span className="material-symbols-outlined text-[18px]">done_all</span>
                                    {t('putaway.confirmPutaway')}
                                </>
                            )}
                        </Button>
                    </div>
                </form>
            ) : null}
        </div>
    );

    return (
        <MasterDetailLayout
            title={t('putaway.title')}
            controls={
                <>
                    <span className="text-sm font-semibold text-[var(--text-muted)]">{tCommon('location')}:</span>
                    <select
                        value={selectedLocationId}
                        onChange={(e) => setSelectedLocationId(e.target.value)}
                        className="input text-sm w-full sm:w-48"
                    >
                        {locations.map(loc => (
                            <option key={loc.locationId} value={loc.locationId}>
                                {loc.code} - {loc.name}
                            </option>
                        ))}
                    </select>
                </>
            }
            masterWidthClass="lg:w-1/2"
            isDetailOpen={!!selectedLine}
            onCloseDetail={() => { setSelectedLine(null); setContext(null); }}
            detailTitle={selectedLine ? `${selectedLine.productName} (${selectedLine.productNumber})` : t('putaway.action')}
            masterPane={
                <>
                    <div className="px-4 py-3 border-b border-[var(--border)] bg-[var(--bg-secondary)] flex justify-between items-center">
                        <h2 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-wider">{t('putaway.pendingPutaway')}</h2>
                        <span className="bg-[var(--accent)] text-white text-xs font-bold px-2 py-0.5 rounded-full">
                            {pendingLines.length}
                        </span>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto p-2 pb-24 lg:pb-2 bg-[var(--bg-card)] lg:bg-transparent rounded-b-md lg:rounded-none">
                        {loadingLines ? (
                            <div className="flex items-center justify-center h-full text-[var(--text-muted)] text-sm">
                                {tCommon('loading')}
                            </div>
                        ) : pendingLines.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full text-[var(--text-muted)] text-sm p-8 text-center">
                                { }
                                <span className="material-symbols-outlined text-4xl mb-2 opacity-50">inventory_2</span>
                                {t('putaway.noItemsPending')}
                            </div>
                        ) : (
                            <div className="flex flex-col gap-2">
                                {pendingLines.map((line, index) => (
                                    <div 
                                        key={line.id || `${line.referenceNumber}-${line.productId}-${index}`}
                                        onClick={() => setSelectedLine(line)}
                                        className={`p-3 rounded-lg border cursor-pointer transition-colors ${selectedLine?.id === line.id ? 'bg-[var(--bg-secondary-hover)] border-[var(--accent)]' : 'border-[var(--border)] hover:bg-[var(--bg-card-hover)]'}`}
                                    >
                                        <div className="flex justify-between items-start mb-1">
                                            <div className="font-bold text-[var(--text-primary)] text-sm">{line.productName}</div>
                                            <div className="font-bold text-[var(--text-primary)] text-sm">{parseFloat(line.quantity).toLocaleString()}</div>
                                        </div>
                                        <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-[var(--text-secondary)]">
                                            {line.sourceType === 'sales_return' ? (
                                                <span className="font-bold text-[var(--warning)] uppercase">{t('putaway.return')}</span>
                                            ) : line.sourceType === 'work_order' ? (
                                                <span className="font-bold text-sky-500 uppercase">WORK ORDER</span>
                                            ) : (
                                                <span className="font-bold text-[var(--success)] uppercase">{t('putaway.receipt')}</span>
                                            )}
                                            <span className="text-[var(--text-muted)]">•</span>
                                            <span className="uppercase tracking-wider">{line.productNumber}</span>
                                            <span className="text-[var(--text-muted)]">•</span>
                                            <span>{t('putaway.ref', { ref: line.referenceNumber })}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </>
            }
            detailPane={
                <>
                    <div className="hidden lg:block px-4 py-3 border-b border-[var(--border)] bg-[var(--bg-secondary)]">
                        <h2 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-wider">{t('putaway.action')}</h2>
                    </div>
                    {actionFormContent}
                </>
            }
        />
    );
}

'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import Link from 'next/link';

import { apiFetch, apiMutate } from '@/lib/api';
import { useSettings } from '@/components/SettingsProvider';

interface PutawayLine {
    goodsReceivedLineId: string;
    goodsReceivedId: string;
    receiptNumber: string;
    vendorName: string;
    productId: string;
    productNumber: string;
    productName: string;
    quantityReceived: string;
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
    useDocumentTitle('Putaway');
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
        apiFetch<any>('/api/inventory/locations')
            .then(response => {
                const locs = response.data || [];
                setLocations(locs);
                if (locs.length > 0) {
                    const defaultLocId = app?.defaultFulfillmentLocationId || locs[0].locationId;
                    setSelectedLocationId(defaultLocId);
                }
            })
            .catch(err => console.error('Failed to load locations', err));
    }, [app?.defaultFulfillmentLocationId]);

    // Fetch Pending Lines
    useEffect(() => {
        if (!selectedLocationId) return;

        setLoadingLines(true);
        setSelectedLine(null);
        setContext(null);

        apiFetch<any>(`/api/goods-received/lines?limit=1000&putawayStatus=pending_putaway&locationId=${selectedLocationId}`)
            .then(data => {
                setPendingLines(data.data || []);
            })
            .catch(err => console.error('Failed to load pending lines', err))
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
        apiFetch<PutawayContext>(`/api/inventory/putaway-context?productId=${selectedLine.productId}&locationId=${selectedLocationId}`)
            .then((data) => {
                setContext(data);
                if (data.primaryBinId) {
                    setSelectedBinId(data.primaryBinId);
                    setBinSearch(data.primaryBinNumber || '');
                } else {
                    setSelectedBinId('');
                    setBinSearch('');
                }
                const expectedTotal = data.currentQuantity + parseFloat(selectedLine.quantityReceived);
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
            await apiMutate('/api/goods-received/putaway', 'POST', {
                putaways: [
                    {
                        lineId: selectedLine.goodsReceivedLineId,
                        destinationBinId: selectedBinId,
                        quantity: selectedLine.quantityReceived,
                        newTotalQuantity
                    }
                ]
            });

            // Remove from list and reset
            setPendingLines(prev => prev.filter(l => l.goodsReceivedLineId !== selectedLine.goodsReceivedLineId));
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
                        Putaway
                    </h1>
                </div>

                <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold text-[var(--text-muted)]">Location:</span>
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
                        <h2 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-wider">Pending Putaway</h2>
                        <span className="bg-[var(--accent)] text-white text-xs font-bold px-2 py-0.5 rounded-full">
                            {pendingLines.length}
                        </span>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto p-2">
                        {loadingLines ? (
                            <div className="flex items-center justify-center h-full text-[var(--text-muted)] text-sm">
                                Loading...
                            </div>
                        ) : pendingLines.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full text-[var(--text-muted)] text-sm p-8 text-center">
                                <span className="material-symbols-outlined text-4xl mb-2 opacity-50">inventory_2</span>
                                No items pending putaway in this location.
                            </div>
                        ) : (
                            <div className="flex flex-col gap-2">
                                {pendingLines.map(line => (
                                    <div 
                                        key={line.goodsReceivedLineId}
                                        onClick={() => setSelectedLine(line)}
                                        className={`p-3 rounded-lg border cursor-pointer transition-colors ${selectedLine?.goodsReceivedLineId === line.goodsReceivedLineId ? 'bg-[var(--bg-secondary-hover)] border-[var(--accent)]' : 'border-[var(--border)] hover:bg-[var(--bg-card-hover)]'}`}
                                    >
                                        <div className="flex justify-between items-start mb-1">
                                            <div className="font-bold text-[var(--text-primary)] text-sm">{line.productNumber}</div>
                                            <div className="font-bold text-[var(--brand-blue)] text-sm">{parseFloat(line.quantityReceived).toLocaleString()}</div>
                                        </div>
                                        <div className="text-xs text-[var(--text-muted)] mb-2">{line.productName}</div>
                                        <div className="flex items-center justify-between text-[11px] text-[var(--text-secondary)]">
                                            <span>Receipt: {line.receiptNumber}</span>
                                            <span>{line.vendorName}</span>
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
                        <h2 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-wider">Putaway Action</h2>
                    </div>

                    <div className="flex-1 overflow-y-auto p-6">
                        {!selectedLine ? (
                            <div className="flex items-center justify-center h-full text-[var(--text-muted)] text-sm">
                                Select an item from the list to putaway.
                            </div>
                        ) : loadingContext ? (
                            <div className="flex items-center justify-center h-full text-[var(--text-muted)] text-sm">
                                Loading bin context...
                            </div>
                        ) : context ? (
                            <form onSubmit={handleSubmit} className="flex flex-col h-full max-w-md mx-auto">
                                <div className="mb-6 pb-4 border-b border-[var(--border)] flex justify-between items-start">
                                    <div>
                                        <h3 className="text-lg font-bold text-[var(--accent)]">{selectedLine.productNumber}</h3>
                                        <p className="text-sm text-[var(--text-secondary)] mt-1">{selectedLine.productName}</p>
                                    </div>
                                    <div className="text-2xl font-bold text-[var(--text-primary)] mt-1">
                                        {parseFloat(selectedLine.quantityReceived).toLocaleString()}
                                    </div>
                                </div>

                                {error && (
                                    <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-md flex items-center gap-2">
                                        <span className="material-symbols-outlined text-sm">error</span>
                                        {error}
                                    </div>
                                )}

                                <div className="space-y-5 flex-1">
                                    <div>
                                        <label className="block text-xs font-bold text-[var(--text-muted)] uppercase mb-1.5">Destination Bin</label>
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
                                            placeholder="Search bins..."
                                            required
                                        />
                                        <datalist id="available-bins">
                                            {context.availableBins.map(bin => (
                                                <option key={bin.binId} value={bin.binNumber}>
                                                    {bin.binId === context.primaryBinId ? '(Primary)' : ''}
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
                                                <span className="material-symbols-outlined text-[14px]">warning</span>
                                                Warning: You are not placing this in the primary bin ({context.primaryBinNumber}).
                                            </p>
                                        )}
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-[var(--text-muted)] uppercase mb-1.5 flex justify-between">
                                            <span>New Total Quantity in Bin</span>
                                            <span className="text-[10px] font-normal normal-case">Current stock: {context.currentQuantity}</span>
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
                                            Verify the physical count. An inventory adjustment will be generated if this differs from system expectations.
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
                                                <span className="material-symbols-outlined animate-spin text-[18px]">sync</span>
                                                Processing...
                                            </>
                                        ) : (
                                            <>
                                                <span className="material-symbols-outlined text-[18px]">done_all</span>
                                                Confirm Putaway
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

'use client';

import { useState, useEffect, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import * as api from '@herobm/sdk';
import { useAuth } from '@/components/AuthGate';
import SlideOver from '@/components/shared/SlideOver';
import toast from 'react-hot-toast';
import { getErrorMessage, BIN_TYPE, SystemResource, hasPermission, compareBinNumbers } from '@herobm/shared';
import { Button } from '@/components/shared/Button';

interface Bin {
  binId: string;
  zoneId: string;
  binNumber: string;
  binType: string | null;
  isConsignment: boolean;
  isBonded: boolean;
  isUnavailable: boolean;
  source: string;
}

interface Zone {
  zoneId: string;
  locationId: string;
  code: string;
  name: string;
  source: string;
  bins: Bin[];
}

interface Location {
  locationId: string;
  code: string;
  name: string;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  stateOrProvince: string | null;
  country: string | null;
  postalCode: string | null;
  source: string;
  zones: Zone[];
}

export default function TopographyView() {
  const tInventory = useTranslations('inventory');
  const tLoc = useTranslations('inventory.locations');
  const tCommon = useTranslations('common');
  const { permissions } = useAuth();
  const canEdit = hasPermission(permissions, SystemResource.INVENTORY, 'write');

  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);

  const [expandedLocations, setExpandedLocations] = useState<Set<string>>(new Set());
  const [expandedZones, setExpandedZones] = useState<Set<string>>(new Set());

  // Modal states
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);
  const [isZoneModalOpen, setIsZoneModalOpen] = useState(false);
  const [isBinModalOpen, setIsBinModalOpen] = useState(false);

  const [editingLocation, setEditingLocation] = useState<Location | null>(null);
  const [editingZone, setEditingZone] = useState<{ zone?: Zone; locationId: string } | null>(null);
  const [editingBin, setEditingBin] = useState<{ bin?: Bin; zoneId: string } | null>(null);

  const fetchLocations = () => {
    setLoading(true);
    api.inventoryControllerGetTopography()
      .then((response) => {
        const data = response.data || [];
        setLocations(data as unknown as Location[]);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    api.inventoryControllerGetTopography()
      .then((response) => {
        const resData = response.data || [];
        const data = resData as unknown as Location[];
        setLocations(data);
        // Auto-expand first location
        if (data.length > 0) {
          setExpandedLocations(new Set([data[0].locationId]));
          if (data[0].zones?.length > 0) {
            setExpandedZones(new Set([data[0].zones[0].zoneId]));
          }
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const toggleLocation = (id: string) => {
    setExpandedLocations((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleZone = (id: string) => {
    setExpandedZones((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const totalBins = (locations || []).reduce(
    (acc, loc) => acc + (loc?.zones || []).reduce((za, z) => za + (z?.bins || []).length, 0),
    0,
  );
  const totalZones = (locations || []).reduce((acc, loc) => acc + (loc?.zones || []).length, 0);

  return (
    <div className="flex-1 min-h-0 flex flex-col z-10 bg-[var(--bg-card)] rounded-xl border border-[var(--border)] overflow-hidden transition-all">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-[var(--border)] gap-3">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 flex-1 min-w-0">
          <div className="flex items-center justify-between sm:justify-start">
            <h2 className="text-lg sm:text-[1.3rem] font-bold tracking-tight text-[var(--text-primary)] shrink-0">
              {tInventory('tabs.locations')}
            </h2>
            {canEdit && (
              <div className="sm:hidden">
                <Button
                  onClick={() => {
                    setEditingLocation(null);
                    setIsLocationModalOpen(true);
                  }}
                  variant="primary"
                  size="sm"
                >
                  {tLoc('addLocation')}
                </Button>
              </div>
            )}
          </div>
          <div className="hidden sm:block h-5 w-px bg-[var(--border)] shrink-0 mx-1"></div>

          {/* Stats */}
          <div className="flex items-center gap-2 sm:gap-3 overflow-x-auto hide-scrollbar pb-1 sm:pb-0">
            <div className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1 sm:py-1.5 bg-[var(--bg-secondary)] rounded-lg shrink-0">
              <span className="text-[10px] sm:text-[11px] font-bold text-[var(--text-primary)] tracking-wider uppercase">
                {tCommon('columns.location')}
              </span>
              <span className="text-[10px] sm:text-[11px] font-bold text-[var(--accent)]">
                {loading ? tCommon('loadingEllipsis') : locations.length}
              </span>
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1 sm:py-1.5 bg-[var(--bg-secondary)] rounded-lg shrink-0">
              <span className="text-[10px] sm:text-[11px] font-bold text-[var(--text-primary)] tracking-wider uppercase">
                {tLoc('zones')}
              </span>
              <span className="text-[10px] sm:text-[11px] font-bold text-[var(--accent)]">
                {loading ? tCommon('loadingEllipsis') : totalZones}
              </span>
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1 sm:py-1.5 bg-[var(--bg-secondary)] rounded-lg shrink-0">
              <span className="text-[10px] sm:text-[11px] font-bold text-[var(--text-primary)] tracking-wider uppercase">
                {tLoc('bins')}
              </span>
              <span className="text-[10px] sm:text-[11px] font-bold text-[var(--accent)]">
                {loading ? tCommon('loadingEllipsis') : totalBins.toLocaleString()}
              </span>
            </div>
          </div>
        </div>
          
        {canEdit && (
          <div className="hidden sm:block shrink-0">
            <Button
              onClick={() => {
                setEditingLocation(null);
                setIsLocationModalOpen(true);
              }}
              variant="primary"
            >
              {tLoc('addLocation')}
            </Button>
          </div>
        )}
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-4 lg:p-6 bg-[var(--bg-primary)]">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <span className="text-sm text-[var(--text-muted)]">
              {tCommon('loading')}
            </span>
          </div>
        ) : locations.length === 0 ? (
          <div className="flex items-center justify-center py-16">
            <span className="text-sm text-[var(--text-muted)]">
              {tCommon('noMatchingResults')}
            </span>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {(locations || []).map((loc) => {
              const isLocExpanded = expandedLocations.has(loc.locationId);
              const binCount = (loc?.zones || []).reduce((a, z) => a + (z?.bins || []).length, 0);

              return (
                <div
                  key={loc.locationId}
                  className={`rounded-xl border overflow-hidden transition-all bg-[var(--bg-card)] ${
                    isLocExpanded ? 'border-[var(--accent)]/40' : 'border-[var(--border)]'
                  }`}
                >
                  {/* Location Row */}
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => toggleLocation(loc.locationId)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleLocation(loc.locationId); } }}
                    className="w-full flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 sm:px-5 sm:py-4 text-left hover:bg-[var(--bg-card-hover)] transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5 sm:gap-3 flex-1 min-w-0">
                      <span className={`material-symbols-outlined text-[18px] transition-transform text-[var(--accent)] shrink-0 ${isLocExpanded ? 'rotate-90' : 'rotate-0'}`}>chevron_right</span>
                      {/* eslint-disable-next-line i18next/no-literal-string -- Material UI Icon */}
                      <span className="material-symbols-outlined text-[20px] sm:text-[22px] text-[var(--accent)] shrink-0">warehouse</span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5 sm:gap-3">
                          <span className="text-sm font-bold text-[var(--text-primary)]">
                            {loc.code}
                          </span>
                          <span className="text-sm text-[var(--text-secondary)] truncate">
                            {loc.name}
                          </span>
                          {loc.city && (
                            <span className="text-xs text-[var(--text-muted)] truncate hidden md:inline">
                              • {loc.city}{loc.country ? `, ${loc.country}` : ''}
                            </span>
                          )}
                        </div>
                        {loc.city && (
                          <div className="text-xs text-[var(--text-muted)] md:hidden">
                            {loc.city}{loc.country ? `, ${loc.country}` : ''}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-2 sm:gap-3 shrink-0 pl-7 sm:pl-0">
                      {canEdit && (
                        <div className="flex items-center gap-1 sm:gap-1.5 sm:mr-2 sm:pr-2 sm:border-r border-[var(--border)]">
                          <Button variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingZone({ locationId: loc.locationId });
                              setIsZoneModalOpen(true);
                            }}
                            className="p-1 sm:p-1.5 hover:bg-emerald-500/10 rounded text-emerald-400 transition-colors"
                            title={tLoc('addZoneTo', { name: loc.code })}
                          >
                            <span className="material-symbols-outlined text-[18px]">add_circle</span>
                          </Button>
                          <Button variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingLocation(loc);
                              setIsLocationModalOpen(true);
                            }}
                            className="p-1 sm:p-1.5 hover:bg-[var(--bg-card-hover)] rounded text-[var(--text-secondary)] transition-colors"
                            title={tCommon('edit')}
                          >
                            <span className="material-symbols-outlined text-[18px]">edit</span>
                          </Button>
                          <Button variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (confirm(tCommon('confirmDelete'))) {
                                api.locationsControllerDeleteLocation(loc.locationId)
                                  .then(() => {
                                    toast.success(tCommon('deleted'));
                                    fetchLocations();
                                  })
                                  .catch((err) => toast.error(getErrorMessage(err)));
                              }
                            }}
                            className="p-1 sm:p-1.5 hover:bg-red-500/10 rounded text-red-400 transition-colors"
                            title={tCommon('delete')}
                          >
                            <span className="material-symbols-outlined text-[18px]">delete</span>
                          </Button>
                        </div>
                      )}
                      <div className="flex items-center gap-1.5">
                        <Button variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigator.clipboard.writeText(loc.locationId);
                            toast.success('Copied to clipboard');
                          }}
                          className="p-1 sm:p-1.5 hover:bg-[var(--bg-card-hover)] rounded text-[var(--text-secondary)] transition-colors"
                          title={`UUID: ${loc.locationId}`}
                        >
                          <span className="material-symbols-outlined text-[18px]">info</span>
                        </Button>
                        <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-[var(--accent)]/10 text-[var(--accent)] whitespace-nowrap">
                          {tLoc('zonesCount', { count: (loc?.zones || []).length })}
                        </span>
                        <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-[var(--text-primary)]/[0.06] text-[var(--text-primary)] whitespace-nowrap">
                          {tLoc('binsCount', { count: binCount })}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Zones */}
                  {isLocExpanded && (
                    <div className="border-t border-[var(--border)]">
                      {(loc?.zones || []).map((zone) => {
                        const isZoneExpanded = expandedZones.has(zone.zoneId);

                        return (
                          <div key={zone.zoneId}>
                            {/* Zone Row */}
                            <div
                              role="button"
                              tabIndex={0}
                              onClick={() => toggleZone(zone.zoneId)}
                              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleZone(zone.zoneId); } }}
                              className="w-full flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 p-3 sm:px-5 sm:py-3 text-left hover:bg-[var(--bg-card-hover)] transition-colors cursor-pointer pl-6 sm:pl-10 md:pl-12"
                            >
                              <div className="flex items-center gap-2.5 sm:gap-3 flex-1 min-w-0">
                                <span className={`material-symbols-outlined text-[16px] transition-transform text-[var(--text-muted)] shrink-0 ${isZoneExpanded ? 'rotate-90' : 'rotate-0'}`}>chevron_right</span>
                                <span className="material-symbols-outlined text-[18px] sm:text-[20px] text-indigo-400 shrink-0">grid_view</span>
                                <div className="flex flex-wrap items-center gap-1.5 sm:gap-3 min-w-0">
                                  <span className="text-sm font-semibold text-[var(--text-primary)]">
                                    {zone.code}
                                  </span>
                                  <span className="text-sm text-[var(--text-secondary)] truncate">
                                    {zone.name}
                                  </span>
                                </div>
                              </div>
                              <div className="flex items-center justify-between sm:justify-end gap-2 sm:gap-3 shrink-0 pl-6 sm:pl-0">
                                {canEdit && (
                                  <div className="flex items-center gap-1 sm:pr-2 sm:mr-2 sm:border-r border-[var(--border)]">
                                    <Button variant="ghost"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setEditingBin({ zoneId: zone.zoneId });
                                        setIsBinModalOpen(true);
                                      }}
                                      className="p-1 sm:p-1.5 hover:bg-emerald-500/10 rounded text-emerald-400 transition-colors"
                                      title={tLoc('addBinTo', { name: zone.code })}
                                    >
                                      <span className="material-symbols-outlined text-[16px]">add_circle</span>
                                    </Button>
                                    <Button variant="ghost"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setEditingZone({ zone, locationId: loc.locationId });
                                        setIsZoneModalOpen(true);
                                      }}
                                      className="p-1 sm:p-1.5 hover:bg-[var(--bg-card-hover)] rounded text-[var(--text-secondary)] transition-colors"
                                      title={tCommon('edit')}
                                    >
                                      <span className="material-symbols-outlined text-[16px]">edit</span>
                                    </Button>
                                    <Button variant="ghost"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        if (zone.code === 'HANDLING') return;
                                        if (confirm(tCommon('confirmDelete'))) {
                                          api.locationsControllerDeleteZone(zone.zoneId)
                                            .then(() => {
                                              toast.success(tCommon('deleted'));
                                              fetchLocations();
                                            })
                                            .catch((err) => toast.error(getErrorMessage(err)));
                                        }
                                      }}
                                      disabled={zone.code === 'HANDLING'}
                                      title={zone.code === 'HANDLING' ? 'System zones cannot be deleted' : tCommon('delete')}
                                      className={`p-1 sm:p-1.5 rounded transition-colors ${zone.code === 'HANDLING' ? 'text-gray-500 cursor-not-allowed' : 'hover:bg-red-500/10 text-red-400'}`}
                                    >
                                      <span className="material-symbols-outlined text-[16px]">delete</span>
                                    </Button>
                                  </div>
                                )}
                                <div className="flex items-center gap-1.5">
                                  <Button variant="ghost"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      navigator.clipboard.writeText(zone.zoneId);
                                      toast.success('Copied to clipboard');
                                    }}
                                    className="p-1 sm:p-1.5 hover:bg-[var(--bg-card-hover)] rounded text-[var(--text-secondary)] transition-colors"
                                    title={`UUID: ${zone.zoneId}`}
                                  >
                                    <span className="material-symbols-outlined text-[16px]">info</span>
                                  </Button>
                                  <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded shrink-0 bg-[var(--text-primary)]/[0.06] text-[var(--text-primary)] whitespace-nowrap">
                                    {tLoc('binsCount', { count: (zone?.bins || []).length })}
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* Bins */}
                            {isZoneExpanded && (zone?.bins || []).length > 0 && (
                              <div className="px-3 pb-3 sm:pl-10 sm:pr-4 md:pl-20 md:pr-5">
                                {/* Mobile Cards View */}
                                <div className="md:hidden flex flex-col gap-2">
                                  {[...(zone?.bins || [])].sort((a, b) => compareBinNumbers(a.binNumber, b.binNumber)).map((bin) => (
                                    <div
                                      key={bin.binId}
                                      className="p-2.5 rounded-lg border border-[var(--border)] bg-[var(--bg-card)] flex items-center justify-between gap-2"
                                    >
                                      <div className="flex flex-col gap-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                          <span className="text-xs font-bold font-mono text-[var(--text-primary)]">
                                            {bin.binNumber}
                                          </span>
                                          {bin.binType && (
                                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--bg-secondary)] text-[var(--text-secondary)] font-medium">
                                              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any -- External API integration boundaries where exact types are unknown. */}
                                              {tLoc(`binTypes.${bin.binType}` as any)}
                                            </span>
                                          )}
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                          {bin.isConsignment && (
                                            <span className="text-[9px] font-bold px-1 py-0.5 rounded bg-indigo-500/10 text-indigo-400">
                                              {/* eslint-disable-next-line no-restricted-syntax -- Technical constant representing consignment status. */}
                                              {'CSG'}
                                            </span>
                                          )}
                                          {bin.isBonded && (
                                            <span className="text-[9px] font-bold px-1 py-0.5 rounded bg-amber-500/10 text-amber-400">
                                              {/* eslint-disable-next-line no-restricted-syntax -- Technical constant representing bonded status. */}
                                              {'BND'}
                                            </span>
                                          )}
                                          {bin.isUnavailable && (
                                            <span className="text-[9px] font-bold px-1 py-0.5 rounded bg-red-500/10 text-red-400">
                                              {tCommon('na')}
                                            </span>
                                          )}
                                        </div>
                                      </div>

                                      <div className="flex items-center gap-1 shrink-0">
                                        {canEdit && (
                                          <>
                                            <Button variant="ghost"
                                              onClick={() => {
                                                setEditingBin({ bin, zoneId: zone.zoneId });
                                                setIsBinModalOpen(true);
                                              }}
                                              className="p-1 hover:bg-[var(--bg-card-hover)] rounded text-[var(--text-secondary)] transition-colors"
                                              title={tCommon('edit')}
                                            >
                                              <span className="material-symbols-outlined text-[16px]">edit</span>
                                            </Button>
                                            <Button variant="ghost"
                                              onClick={() => {
                                                if (bin.binNumber === 'RECEIVING' || bin.binNumber === 'SHIPPING') return;
                                                if (confirm(tCommon('confirmDelete'))) {
                                                  api.locationsControllerDeleteBin(bin.binId)
                                                    .then(() => {
                                                      toast.success(tCommon('deleted'));
                                                      fetchLocations();
                                                    })
                                                    .catch((err) => toast.error(getErrorMessage(err)));
                                                }
                                              }}
                                              disabled={bin.binNumber === 'RECEIVING' || bin.binNumber === 'SHIPPING'}
                                              title={(bin.binNumber === 'RECEIVING' || bin.binNumber === 'SHIPPING') ? 'System bins cannot be deleted' : tCommon('delete')}
                                              className={`p-1 rounded transition-colors ${(bin.binNumber === 'RECEIVING' || bin.binNumber === 'SHIPPING') ? 'text-gray-500 cursor-not-allowed' : 'hover:bg-red-500/10 text-red-400'}`}
                                            >
                                              <span className="material-symbols-outlined text-[16px]">delete</span>
                                            </Button>
                                          </>
                                        )}
                                        <Button variant="ghost"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            navigator.clipboard.writeText(bin.binId);
                                            toast.success(tCommon('copiedToClipboard'));
                                          }}
                                          className="p-1 hover:bg-[var(--bg-card-hover)] rounded text-[var(--text-secondary)] transition-colors"
                                          title={`UUID: ${bin.binId}`}
                                        >
                                          <span className="material-symbols-outlined text-[16px]">info</span>
                                        </Button>
                                      </div>
                                    </div>
                                  ))}
                                </div>

                                {/* Desktop Table View */}
                                <div className="hidden md:block rounded-lg border overflow-hidden border-[var(--border)]">
                                  <table className="w-full text-sm border-collapse">
                                    <thead>
                                      <tr className="bg-[var(--bg-secondary)]">
                                        <th
                                          className="text-left px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]"
                                        >
                                          {tLoc('bins')}
                                        </th>
                                        <th
                                          className="text-left px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]"
                                        >
                                          {tCommon('columns.type')}
                                        </th>
                                        <th
                                          className="text-center px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]"
                                        >
                                          {tLoc('fields.flags')}
                                        </th>
                                        <th
                                          className="px-4 py-2 text-right text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]"
                                        >
                                        </th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {[...(zone?.bins || [])].sort((a, b) => compareBinNumbers(a.binNumber, b.binNumber)).map((bin, idx) => (
                                        <tr
                                          key={bin.binId}
                                          className={idx > 0 ? 'border-t border-[var(--border)]' : ''}
                                        >
                                          <td className="px-4 py-2 font-medium text-[var(--text-primary)] tabular-nums">
                                            {bin.binNumber}
                                          </td>
                                          <td className="px-4 py-2 text-[var(--text-secondary)]">
                                            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any -- External API integration boundaries where exact types are unknown. */}
                                            {bin.binType ? tLoc(`binTypes.${bin.binType}` as any) : '—'}
                                          </td>
                                          <td className="px-4 py-2 text-center">
                                            <div className="flex items-center justify-center gap-1.5">
                                              {bin.isConsignment && (
                                                <span
                                                  className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-400"
                                                >
                                                  {/* eslint-disable-next-line no-restricted-syntax -- Technical constant representing consignment status. */}
                                                  {'CSG'}
                                                </span>
                                              )}
                                              {bin.isBonded && (
                                                <span
                                                  className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400"
                                                >
                                                  {/* eslint-disable-next-line no-restricted-syntax -- Technical constant representing bonded status. */}
                                                  {'BND'}
                                                </span>
                                              )}
                                              {bin.isUnavailable && (
                                                <span
                                                  className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-500/10 text-red-400"
                                                >
                                                  {tCommon('na')}
                                                </span>
                                              )}
                                              {!bin.isConsignment && !bin.isBonded && !bin.isUnavailable && (
                                                <span className="text-[var(--text-muted)]">—</span>
                                              )}
                                            </div>
                                          </td>
                                          <td className="px-2 py-2">
                                            <div className="flex items-center justify-end gap-1">
                                              {canEdit && (
                                                <>
                                                  <Button variant="ghost"
                                                    onClick={() => {
                                                      setEditingBin({ bin, zoneId: zone.zoneId });
                                                      setIsBinModalOpen(true);
                                                    }}
                                                    className="p-1 hover:bg-[var(--bg-card-hover)] rounded text-[var(--text-secondary)] transition-colors"
                                                  >
                                                    { }
                                                    <span className="material-symbols-outlined text-[16px]">edit</span>
                                                  </Button>
                                                  <Button variant="ghost"
                                                    onClick={() => {
                                                      if (bin.binNumber === 'RECEIVING' || bin.binNumber === 'SHIPPING') return;
                                                      if (confirm(tCommon('confirmDelete'))) {
                                                        api.locationsControllerDeleteBin(bin.binId)
                                                          .then(() => {
                                                            toast.success(tCommon('deleted'));
                                                            fetchLocations();
                                                          })
                                                          .catch((err) => toast.error(getErrorMessage(err)));
                                                      }
                                                    }}
                                                    disabled={bin.binNumber === 'RECEIVING' || bin.binNumber === 'SHIPPING'}
                                                    title={(bin.binNumber === 'RECEIVING' || bin.binNumber === 'SHIPPING') ? 'System bins cannot be deleted' : tCommon('delete')}
                                                    className={`p-1 rounded transition-colors ${(bin.binNumber === 'RECEIVING' || bin.binNumber === 'SHIPPING') ? 'text-gray-500 cursor-not-allowed' : 'hover:bg-red-500/10 text-red-400'}`}
                                                  >
                                                    { }
                                                    <span className="material-symbols-outlined text-[16px]">delete</span>
                                                  </Button>
                                                </>
                                              )}
                                              <Button variant="ghost"
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  navigator.clipboard.writeText(bin.binId);
                                                  toast.success(tCommon('copiedToClipboard'));
                                                }}
                                                className="p-1 hover:bg-[var(--bg-card-hover)] rounded text-[var(--text-secondary)] transition-colors"
                                                title={`UUID: ${bin.binId}`}
                                              >
                                                <span className="material-symbols-outlined text-[16px]">info</span>
                                              </Button>
                                            </div>
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            )}

                            {isZoneExpanded && (zone?.bins || []).length === 0 && (
                              <div className="px-3 pb-3 sm:pl-10 md:pl-20 pr-5">
                                <p className="text-sm italic mb-2 text-[var(--text-muted)]">
                                  {tLoc('noBinsInZone')}
                                </p>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
      
      {/* Modals */}
      <LocationModal 
        isOpen={isLocationModalOpen} 
        onClose={() => setIsLocationModalOpen(false)} 
        onSuccess={fetchLocations}
        editingLocation={editingLocation}
      />
      <ZoneModal
        isOpen={isZoneModalOpen}
        onClose={() => setIsZoneModalOpen(false)}
        onSuccess={fetchLocations}
        initialData={editingZone}
      />
      <BinModal
        isOpen={isBinModalOpen}
        onClose={() => setIsBinModalOpen(false)}
        onSuccess={fetchLocations}
        initialData={editingBin}
      />
    </div>
  );
}

function LocationModal({ isOpen, onClose, onSuccess, editingLocation }: { isOpen: boolean; onClose: () => void; onSuccess: () => void; editingLocation: Location | null }) {
  const t = useTranslations('common');
  const tLoc = useTranslations('inventory.locations');
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({ code: '', name: '', addressLine1: '', addressLine2: '', city: '', stateOrProvince: '', country: '', postalCode: '' });

  useEffect(() => {
    if (editingLocation) {
      setFormData({ 
        code: editingLocation.code, 
        name: editingLocation.name, 
        addressLine1: editingLocation.addressLine1 || '',
        addressLine2: editingLocation.addressLine2 || '',
        city: editingLocation.city || '', 
        stateOrProvince: editingLocation.stateOrProvince || '',
        country: editingLocation.country || '',
        postalCode: editingLocation.postalCode || ''
      });
    } else {
      setFormData({ code: '', name: '', addressLine1: '', addressLine2: '', city: '', stateOrProvince: '', country: '', postalCode: '' });
    }
  }, [editingLocation, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (editingLocation) {
        await api.locationsControllerUpdateLocation(editingLocation.locationId, formData);
      } else {
        await api.locationsControllerCreateLocation(formData);
      }
      toast.success(editingLocation ? t('updated') : t('created'));
      onSuccess();
      onClose();
    } catch (err: unknown) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <SlideOver
      isOpen={isOpen}
      onClose={onClose}
      title={editingLocation ? `${t('edit')} ${t('location')}` : `${t('add')} ${t('location')}`}
    >
      <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-5">
        <div className="flex flex-col gap-1.5">
          <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">{t('columns.code')}</label>
          <input 
            className="input" 
            required 
            value={formData.code} 
            onChange={e => setFormData({...formData, code: e.target.value.toUpperCase()})}
            placeholder={tLoc('placeholders.locationCode')}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">{t('columns.name')}</label>
          <input 
            className="input" 
            required 
            value={formData.name} 
            onChange={e => setFormData({...formData, name: e.target.value})}
            placeholder={tLoc('placeholders.locationName')}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">{tLoc('fields.addressLine1')}</label>
          <input 
            className="input" 
            value={formData.addressLine1} 
            onChange={e => setFormData({...formData, addressLine1: e.target.value})}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">{tLoc('fields.addressLine2')}</label>
          <input 
            className="input" 
            value={formData.addressLine2} 
            onChange={e => setFormData({...formData, addressLine2: e.target.value})}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">{tLoc('fields.city')}</label>
          <input 
            className="input" 
            value={formData.city} 
            onChange={e => setFormData({...formData, city: e.target.value})}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">{tLoc('fields.stateOrProvince')}</label>
          <input 
            className="input" 
            value={formData.stateOrProvince} 
            onChange={e => setFormData({...formData, stateOrProvince: e.target.value})}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">{tLoc('fields.country')}</label>
          <input 
            className="input" 
            value={formData.country} 
            onChange={e => setFormData({...formData, country: e.target.value})}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">{tLoc('fields.postalCode')}</label>
          <input 
            className="input" 
            value={formData.postalCode} 
            onChange={e => setFormData({...formData, postalCode: e.target.value})}
          />
        </div>
        <div className="flex justify-end gap-3 mt-4">
          <Button type="button" onClick={onClose} variant="secondary">
            {t('cancel')}
          </Button>
          <Button type="submit" disabled={loading} variant="primary">
            {loading ? t('loading') : editingLocation ? t('save') : t('create')}
          </Button>
        </div>
      </form>
    </SlideOver>
  );
}

function ZoneModal({ isOpen, onClose, onSuccess, initialData }: { isOpen: boolean; onClose: () => void; onSuccess: () => void; initialData: { zone?: Zone; locationId: string } | null }) {
  const t = useTranslations('common');
  const tLoc = useTranslations('inventory.locations');
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({ code: '', name: '' });

  useEffect(() => {
    if (initialData?.zone) {
      setFormData({ code: initialData.zone.code, name: initialData.zone.name });
    } else {
      setFormData({ code: '', name: '' });
    }
  }, [initialData, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!initialData) return;
    setLoading(true);
    try {
      if (initialData.zone) {
        await api.locationsControllerUpdateZone(initialData.zone.zoneId, formData);
      } else {
        await api.locationsControllerCreateZone({ ...formData, locationId: initialData.locationId });
      }
      toast.success(initialData.zone ? t('updated') : t('created'));
      onSuccess();
      onClose();
    } catch (err: unknown) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <SlideOver
      isOpen={isOpen}
      onClose={onClose}
      title={initialData?.zone ? tLoc('editZone') : tLoc('addZone')}
    >
      <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-5">
        <div className="flex flex-col gap-1.5">
          <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">{tLoc('fields.zoneCode')}</label>
          <input 
            className="input" 
            required 
            value={formData.code} 
            onChange={e => setFormData({...formData, code: e.target.value.toUpperCase()})}
            placeholder={tLoc('placeholders.zoneCode')}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">{tLoc('fields.zoneName')}</label>
          <input 
            className="input" 
            required 
            value={formData.name} 
            onChange={e => setFormData({...formData, name: e.target.value})}
            placeholder={tLoc('placeholders.zoneName')}
          />
        </div>
        <div className="flex justify-end gap-3 mt-4">
          <Button type="button" onClick={onClose} variant="secondary">
            {t('cancel')}
          </Button>
          <Button type="submit" disabled={loading} variant="primary">
            {loading ? t('loadingEllipsis') : initialData?.zone ? t('save') : t('create')}
          </Button>
        </div>
      </form>
    </SlideOver>
  );
}

function BinModal({ isOpen, onClose, onSuccess, initialData }: { isOpen: boolean; onClose: () => void; onSuccess: () => void; initialData: { bin?: Bin; zoneId: string } | null }) {
  const tCommon = useTranslations('common');
  const tLoc = useTranslations('inventory.locations');
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<'single' | 'batch'>('single');

  // Single form
  const [formData, setFormData] = useState({ binNumber: '', binType: '', isConsignment: false, isBonded: false, isUnavailable: false });

  // Bulk form
  const [bulkData, setBulkData] = useState({
    aisleStart: 'A',
    aisleEnd: 'L',
    rackStart: 1,
    rackEnd: 9,
    shelfStart: 1,
    shelfEnd: 14,
    separator: '.',
  });

  useEffect(() => {
    if (initialData?.bin) {
      setMode('single');
      setFormData({ 
        binNumber: initialData.bin.binNumber, 
        binType: initialData.bin.binType || '',
        isConsignment: initialData.bin.isConsignment,
        isBonded: initialData.bin.isBonded,
        isUnavailable: initialData.bin.isUnavailable
      });
    } else {
      setMode('single');
      setFormData({ binNumber: '', binType: BIN_TYPE.STORAGE, isConsignment: false, isBonded: false, isUnavailable: false });
      setBulkData({
        aisleStart: 'A',
        aisleEnd: 'L',
        rackStart: 1,
        rackEnd: 9,
        shelfStart: 1,
        shelfEnd: 14,
        separator: '.',
      });
    }
  }, [initialData, isOpen]);

  // Bulk generated bin numbers
  const generatedBinNumbers = useMemo(() => {
    if (mode !== 'batch') return [];
    const binsArr: string[] = [];
    const startChar = (bulkData.aisleStart || 'A').toUpperCase().charCodeAt(0);
    const endChar = (bulkData.aisleEnd || bulkData.aisleStart || 'A').toUpperCase().charCodeAt(0);
    const rStart = Math.min(bulkData.rackStart || 1, bulkData.rackEnd || 1);
    const rEnd = Math.max(bulkData.rackStart || 1, bulkData.rackEnd || 1);
    const sStart = Math.min(bulkData.shelfStart || 1, bulkData.shelfEnd || 1);
    const sEnd = Math.max(bulkData.shelfStart || 1, bulkData.shelfEnd || 1);
    const sep = bulkData.separator;

    for (let c = startChar; c <= endChar; c++) {
      const aisle = String.fromCharCode(c);
      for (let r = rStart; r <= rEnd; r++) {
        for (let s = sStart; s <= sEnd; s++) {
          binsArr.push(`${aisle}${sep}${r}${sep}${s}`);
        }
      }
    }
    return binsArr;
  }, [mode, bulkData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!initialData) return;
    setLoading(true);

    try {
      if (initialData.bin) {
        // Edit single bin
        const payload: Record<string, unknown> = { ...formData };
        if (formData.binType) payload.binType = formData.binType;
        await api.locationsControllerUpdateBin(initialData.bin.binId, payload);
        toast.success('Updated');
      } else if (mode === 'single') {
        // Create single bin
        const payload: Record<string, unknown> = { ...formData };
        if (formData.binType) payload.binType = formData.binType;
        await api.locationsControllerCreateBin({ ...payload, zoneId: initialData.zoneId } as unknown as api.CreateBinDto);
        toast.success('Created');
      } else {
        // Create bulk bins
        const binsPayload = generatedBinNumbers.map((binNumber) => ({
          binNumber,
          zoneId: initialData.zoneId,
          binType: formData.binType || BIN_TYPE.STORAGE,
          isConsignment: formData.isConsignment,
          isBonded: formData.isBonded,
          isUnavailable: formData.isUnavailable,
        }));

        await api.locationsControllerCreateBinsBulk({ bins: binsPayload as api.CreateBinDto[] });
        toast.success('Created');
      }
      onSuccess();
      onClose();
    } catch (err: unknown) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <SlideOver
      isOpen={isOpen}
      onClose={onClose}
      title={initialData?.bin ? tLoc('editBin') : tLoc('addBin')}
    >
      <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-5">
        {!initialData?.bin && (
          <div className="flex bg-[#f2f4f6] p-1 rounded-lg">
            <Button
              type="button"
              variant={mode === 'single' ? 'secondary' : 'ghost'}
              onClick={() => setMode('single')}
              className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${
                mode === 'single' ? 'bg-white shadow text-[#041627]' : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              Single Bin
            </Button>
            <Button
              type="button"
              variant={mode === 'batch' ? 'secondary' : 'ghost'}
              onClick={() => setMode('batch')}
              className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${
                mode === 'batch' ? 'bg-white shadow text-[#041627]' : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              Bulk Multi-Create
            </Button>
          </div>
        )}

        {mode === 'single' ? (
          <div className="flex flex-col gap-1.5">
            <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">{tLoc('fields.binNumber')}</label>
            <input 
              className="input" 
              required 
              value={formData.binNumber} 
              onChange={e => setFormData({...formData, binNumber: e.target.value.toUpperCase()})}
              placeholder={tLoc('placeholders.binNumber')}
            />
          </div>
        ) : (
          <div className="flex flex-col gap-4 bg-gray-50 p-4 rounded-lg border border-gray-200">
            <h4 className="text-xs font-bold uppercase tracking-wider text-gray-700">Pattern Range Setup</h4>
            
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-gray-600 mb-1">Aisle Start (Letter)</label>
                <input
                  className="input text-center uppercase"
                  maxLength={2}
                  required
                  value={bulkData.aisleStart}
                  onChange={(e) => setBulkData({ ...bulkData, aisleStart: e.target.value.toUpperCase() })}
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-gray-600 mb-1">Aisle End (Letter)</label>
                <input
                  className="input text-center uppercase"
                  maxLength={2}
                  required
                  value={bulkData.aisleEnd}
                  onChange={(e) => setBulkData({ ...bulkData, aisleEnd: e.target.value.toUpperCase() })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-gray-600 mb-1">Rack Start</label>
                <input
                  type="number"
                  min={1}
                  className="input text-center"
                  required
                  value={bulkData.rackStart}
                  onChange={(e) => setBulkData({ ...bulkData, rackStart: parseInt(e.target.value) || 1 })}
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-gray-600 mb-1">Rack End</label>
                <input
                  type="number"
                  min={1}
                  className="input text-center"
                  required
                  value={bulkData.rackEnd}
                  onChange={(e) => setBulkData({ ...bulkData, rackEnd: parseInt(e.target.value) || 1 })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-gray-600 mb-1">Shelf Start</label>
                <input
                  type="number"
                  min={1}
                  className="input text-center"
                  required
                  value={bulkData.shelfStart}
                  onChange={(e) => setBulkData({ ...bulkData, shelfStart: parseInt(e.target.value) || 1 })}
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-gray-600 mb-1">Shelf End</label>
                <input
                  type="number"
                  min={1}
                  className="input text-center"
                  required
                  value={bulkData.shelfEnd}
                  onChange={(e) => setBulkData({ ...bulkData, shelfEnd: parseInt(e.target.value) || 1 })}
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-gray-600 mb-1">Separator</label>
              <input
                className="input text-center"
                maxLength={3}
                value={bulkData.separator}
                onChange={(e) => setBulkData({ ...bulkData, separator: e.target.value })}
                placeholder="."
              />
            </div>

            <div className="p-3 bg-white rounded border border-gray-200">
              <div className="text-xs font-semibold text-gray-700 flex justify-between mb-1">
                <span>Total Bins to Create:</span>
                <span className="text-emerald-700 font-bold">{generatedBinNumbers.length.toLocaleString()}</span>
              </div>
              {generatedBinNumbers.length > 0 && (
                <div className="text-[11px] text-gray-500 truncate">
                  Preview: {generatedBinNumbers.slice(0, 3).join(', ')} ... {generatedBinNumbers.slice(-2).join(', ')}
                </div>
              )}
            </div>
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">{tLoc('fields.binType')}</label>
          <select
            className="input"
            value={formData.binType}
            onChange={e => setFormData({...formData, binType: e.target.value})}
          >
            <option value="storage">{tLoc('binTypes.storage')}</option>
            <option value="pick">{tLoc('binTypes.pick')}</option>
            <option value="bulk">{tLoc('binTypes.bulk')}</option>
            <option value="staging">{tLoc('binTypes.staging')}</option>
            <option value="wip">{tLoc('binTypes.wip')}</option>
            <option value="quarantine">{tLoc('binTypes.quarantine')}</option>
          </select>
        </div>

        <div className="flex flex-col gap-3 pt-2">
          <label className="flex items-center gap-3 cursor-pointer group">
            <input 
              type="checkbox" 
              checked={formData.isConsignment} 
              onChange={e => setFormData({...formData, isConsignment: e.target.checked})}
              className="checkbox-blue"
            />
            <span className="text-sm font-medium">{tLoc('fields.consignment')}</span>
          </label>
          <label className="flex items-center gap-3 cursor-pointer group">
            <input 
              type="checkbox" 
              checked={formData.isBonded} 
              onChange={e => setFormData({...formData, isBonded: e.target.checked})}
              className="checkbox-blue"
            />
            <span className="text-sm font-medium">{tLoc('fields.bonded')}</span>
          </label>
          <label className="flex items-center gap-3 cursor-pointer group">
            <input 
              type="checkbox" 
              checked={formData.isUnavailable} 
              onChange={e => setFormData({...formData, isUnavailable: e.target.checked})}
              className="checkbox-blue"
            />
            <span className="text-sm font-medium">{tLoc('fields.unavailable')}</span>
          </label>
        </div>

        <div className="flex justify-end gap-3 mt-4">
          <Button type="button" onClick={onClose} variant="secondary">
            {tCommon('cancel')}
          </Button>
          <Button type="submit" disabled={loading || (mode === 'batch' && generatedBinNumbers.length === 0)} variant="primary">
            {loading
              ? tCommon('loading')
              : initialData?.bin
              ? tCommon('save')
              : mode === 'batch'
              ? `Create ${generatedBinNumbers.length.toLocaleString()} Bins`
              : tCommon('create')}
          </Button>
        </div>
      </form>
    </SlideOver>
  );
}

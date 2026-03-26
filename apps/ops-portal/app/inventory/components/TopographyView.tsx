'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { apiFetch } from '@/lib/api';

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
  city: string | null;
  country: string | null;
  source: string;
  zones: Zone[];
}

export default function TopographyView() {
  const tInventory = useTranslations('inventory');
  const tCommon = useTranslations('common');
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedLocations, setExpandedLocations] = useState<Set<string>>(new Set());
  const [expandedZones, setExpandedZones] = useState<Set<string>>(new Set());

  useEffect(() => {
    apiFetch<{ data: Location[] }>('/api/inventory/locations')
      .then((res) => {
        setLocations(res.data);
        // Auto-expand first location
        if (res.data.length > 0) {
          setExpandedLocations(new Set([res.data[0].locationId]));
          if (res.data[0].zones.length > 0) {
            setExpandedZones(new Set([res.data[0].zones[0].zoneId]));
          }
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const toggleLocation = (id: string) => {
    setExpandedLocations((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleZone = (id: string) => {
    setExpandedZones((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const totalBins = locations.reduce(
    (acc, loc) => acc + loc.zones.reduce((za, z) => za + z.bins.length, 0),
    0,
  );
  const totalZones = locations.reduce((acc, loc) => acc + loc.zones.length, 0);

  return (
    <div className="flex-1 min-h-0 flex flex-col z-10 bg-white rounded-xl shadow-sm border border-[rgba(196,198,205,0.4)] overflow-hidden transition-all">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-[rgba(196,198,205,0.4)]">
        <div className="flex items-center gap-4 flex-1">
          <h2
            className="text-[1.3rem] font-bold tracking-tight text-[#041627] shrink-0"
            style={{ fontFamily: 'Manrope, sans-serif' }}
          >
            {tInventory('tabs.locations')}
          </h2>
          <div className="h-5 w-px bg-[rgba(196,198,205,0.4)] shrink-0 mx-2"></div>

          {/* Stats */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-[#f2f4f6] rounded-lg">
              <span
                className="text-[11px] font-bold text-[#041627] tracking-wider uppercase"
                style={{ fontFamily: 'Manrope, sans-serif' }}
              >
                {tCommon('columns.city', { defaultValue: 'Locations' })}
              </span>
              <span className="text-[11px] font-bold text-[#006b5c]">
                {loading ? '...' : locations.length}
              </span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 bg-[#f2f4f6] rounded-lg">
              <span
                className="text-[11px] font-bold text-[#041627] tracking-wider uppercase"
                style={{ fontFamily: 'Manrope, sans-serif' }}
              >
                Zones
              </span>
              <span className="text-[11px] font-bold text-[#006b5c]">
                {loading ? '...' : totalZones}
              </span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 bg-[#f2f4f6] rounded-lg">
              <span
                className="text-[11px] font-bold text-[#041627] tracking-wider uppercase"
                style={{ fontFamily: 'Manrope, sans-serif' }}
              >
                Bins
              </span>
              <span className="text-[11px] font-bold text-[#006b5c]">
                {loading ? '...' : totalBins.toLocaleString()}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4 lg:p-6" style={{ background: '#fafbfc' }}>
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
              {tCommon('loading')}
            </span>
          </div>
        ) : locations.length === 0 ? (
          <div className="flex items-center justify-center py-16">
            <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
              {tCommon('noMatchingResults')}
            </span>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {locations.map((loc) => {
              const isLocExpanded = expandedLocations.has(loc.locationId);
              const binCount = loc.zones.reduce((a, z) => a + z.bins.length, 0);

              return (
                <div
                  key={loc.locationId}
                  className="rounded-xl border overflow-hidden transition-all"
                  style={{
                    borderColor: isLocExpanded ? 'rgba(0,107,92,0.3)' : 'rgba(196,198,205,0.4)',
                    background: '#fff',
                  }}
                >
                  {/* Location Row */}
                  <button
                    onClick={() => toggleLocation(loc.locationId)}
                    className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-[#f8f9fa] transition-colors"
                  >
                    <span
                      className="material-symbols-outlined text-[18px] transition-transform"
                      style={{
                        color: 'var(--accent)',
                        transform: isLocExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                      }}
                    >
                      chevron_right
                    </span>
                    <span
                      className="material-symbols-outlined text-[22px]"
                      style={{ color: 'var(--accent)' }}
                    >
                      warehouse
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-bold text-[#041627]" style={{ fontFamily: 'Manrope, sans-serif' }}>
                          {loc.code}
                        </span>
                        <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                          {loc.name}
                        </span>
                        {loc.city && (
                          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                            • {loc.city}{loc.country ? `, ${loc.country}` : ''}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span
                        className="text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded"
                        style={{
                          background: 'rgba(0,107,92,0.08)',
                          color: '#006b5c',
                          fontFamily: 'Manrope, sans-serif',
                        }}
                      >
                        {loc.zones.length} {loc.zones.length === 1 ? 'zone' : 'zones'}
                      </span>
                      <span
                        className="text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded"
                        style={{
                          background: 'rgba(4,22,39,0.06)',
                          color: '#041627',
                          fontFamily: 'Manrope, sans-serif',
                        }}
                      >
                        {binCount.toLocaleString()} {binCount === 1 ? 'bin' : 'bins'}
                      </span>
                      <span
                        className="text-[10px] font-medium px-2 py-0.5 rounded"
                        style={{
                          background: loc.source === 'app' ? 'rgba(59,130,246,0.1)' : 'rgba(245,158,11,0.1)',
                          color: loc.source === 'app' ? '#2563eb' : '#b45309',
                        }}
                      >
                        {loc.source}
                      </span>
                    </div>
                  </button>

                  {/* Zones */}
                  {isLocExpanded && (
                    <div className="border-t" style={{ borderColor: 'rgba(196,198,205,0.3)' }}>
                      {loc.zones.map((zone) => {
                        const isZoneExpanded = expandedZones.has(zone.zoneId);

                        return (
                          <div key={zone.zoneId}>
                            {/* Zone Row */}
                            <button
                              onClick={() => toggleZone(zone.zoneId)}
                              className="w-full flex items-center gap-4 px-5 py-3 text-left hover:bg-[#f0faf8] transition-colors"
                              style={{ paddingLeft: 48 }}
                            >
                              <span
                                className="material-symbols-outlined text-[16px] transition-transform"
                                style={{
                                  color: 'var(--text-muted)',
                                  transform: isZoneExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                                }}
                              >
                                chevron_right
                              </span>
                              <span
                                className="material-symbols-outlined text-[20px]"
                                style={{ color: '#6366f1' }}
                              >
                                grid_view
                              </span>
                              <div className="flex items-center gap-3 flex-1 min-w-0">
                                <span className="text-sm font-semibold text-[#041627]">
                                  {zone.code}
                                </span>
                                <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                                  {zone.name}
                                </span>
                              </div>
                              <span
                                className="text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded shrink-0"
                                style={{
                                  background: 'rgba(4,22,39,0.06)',
                                  color: '#041627',
                                  fontFamily: 'Manrope, sans-serif',
                                }}
                              >
                                {zone.bins.length.toLocaleString()} {zone.bins.length === 1 ? 'bin' : 'bins'}
                              </span>
                            </button>

                            {/* Bins Table */}
                            {isZoneExpanded && zone.bins.length > 0 && (
                              <div style={{ paddingLeft: 80 }} className="pb-3 pr-5">
                                <div
                                  className="rounded-lg border overflow-hidden"
                                  style={{ borderColor: 'rgba(196,198,205,0.3)' }}
                                >
                                  <table className="w-full text-sm" style={{ borderCollapse: 'collapse' }}>
                                    <thead>
                                      <tr style={{ background: '#f8f9fa' }}>
                                        <th
                                          className="text-left px-4 py-2 text-[11px] font-bold uppercase tracking-wider"
                                          style={{ color: 'var(--text-muted)', fontFamily: 'Manrope, sans-serif' }}
                                        >
                                          Bin
                                        </th>
                                        <th
                                          className="text-left px-4 py-2 text-[11px] font-bold uppercase tracking-wider"
                                          style={{ color: 'var(--text-muted)', fontFamily: 'Manrope, sans-serif' }}
                                        >
                                          Type
                                        </th>
                                        <th
                                          className="text-center px-4 py-2 text-[11px] font-bold uppercase tracking-wider"
                                          style={{ color: 'var(--text-muted)', fontFamily: 'Manrope, sans-serif' }}
                                        >
                                          Flags
                                        </th>
                                        <th
                                          className="text-left px-4 py-2 text-[11px] font-bold uppercase tracking-wider"
                                          style={{ color: 'var(--text-muted)', fontFamily: 'Manrope, sans-serif' }}
                                        >
                                          Source
                                        </th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {zone.bins.map((bin, idx) => (
                                        <tr
                                          key={bin.binId}
                                          style={{
                                            borderTop: idx > 0 ? '1px solid rgba(196,198,205,0.2)' : undefined,
                                          }}
                                        >
                                          <td className="px-4 py-2 font-medium text-[#041627]" style={{ fontVariantNumeric: 'tabular-nums' }}>
                                            {bin.binNumber}
                                          </td>
                                          <td className="px-4 py-2" style={{ color: 'var(--text-secondary)' }}>
                                            {bin.binType || '—'}
                                          </td>
                                          <td className="px-4 py-2 text-center">
                                            <div className="flex items-center justify-center gap-1.5">
                                              {bin.isConsignment && (
                                                <span
                                                  className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                                                  style={{ background: 'rgba(99,102,241,0.1)', color: '#6366f1' }}
                                                >
                                                  CSG
                                                </span>
                                              )}
                                              {bin.isBonded && (
                                                <span
                                                  className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                                                  style={{ background: 'rgba(245,158,11,0.1)', color: '#b45309' }}
                                                >
                                                  BND
                                                </span>
                                              )}
                                              {bin.isUnavailable && (
                                                <span
                                                  className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                                                  style={{ background: 'rgba(239,68,68,0.1)', color: '#dc2626' }}
                                                >
                                                  N/A
                                                </span>
                                              )}
                                              {!bin.isConsignment && !bin.isBonded && !bin.isUnavailable && (
                                                <span style={{ color: 'var(--text-muted)' }}>—</span>
                                              )}
                                            </div>
                                          </td>
                                          <td className="px-4 py-2">
                                            <span
                                              className="text-[10px] font-medium px-2 py-0.5 rounded"
                                              style={{
                                                background: bin.source === 'app' ? 'rgba(59,130,246,0.1)' : 'rgba(245,158,11,0.1)',
                                                color: bin.source === 'app' ? '#2563eb' : '#b45309',
                                              }}
                                            >
                                              {bin.source}
                                            </span>
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            )}

                            {isZoneExpanded && zone.bins.length === 0 && (
                              <div style={{ paddingLeft: 80 }} className="pb-3 pr-5">
                                <p className="text-sm italic" style={{ color: 'var(--text-muted)' }}>
                                  No bins in this zone.
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
    </div>
  );
}

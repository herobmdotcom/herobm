'use client';

import { useState, useEffect, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/components/AuthGate';
import SlideOver from '@/components/shared/SlideOver';
import toast from 'react-hot-toast';

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
  const tLoc = useTranslations('inventory.locations');
  const tCommon = useTranslations('common');
  const { role } = useAuth();
  const canEdit = role === 'admin';

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
    apiFetch<{ data: Location[] }>('/api/inventory/locations')
      .then((res) => {
        setLocations(res.data);
      })
      .finally(() => setLoading(false));
  };

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
                {tCommon('columns.location', { defaultValue: 'Location' })}
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
                {tLoc('zones')}
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
                {tLoc('bins')}
              </span>
              <span className="text-[11px] font-bold text-[#006b5c]">
                {loading ? '...' : totalBins.toLocaleString()}
              </span>
            </div>
          </div>
        </div>
          
        {canEdit && (
          <button
            onClick={() => {
              setEditingLocation(null);
              setIsLocationModalOpen(true);
            }}
            className="btn btn-primary"
          >
            {tLoc('addLocation')}
          </button>
        )}
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
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => toggleLocation(loc.locationId)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleLocation(loc.locationId); } }}
                    className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-[#f8f9fa] transition-colors cursor-pointer"
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
                      {canEdit && (
                        <div className="flex items-center gap-1.5 mr-2 pr-2 border-r border-[rgba(196,198,205,0.3)]">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingLocation(loc);
                              setIsLocationModalOpen(true);
                            }}
                            className="p-1.5 hover:bg-[#eef2f6] rounded text-[#475569] transition-colors"
                            title={tCommon('edit')}
                          >
                            
                            <span className="material-symbols-outlined text-[18px]">edit</span>
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (confirm(tCommon('confirmDelete'))) {
                                apiFetch(`/api/inventory/locations/${loc.locationId}`, { method: 'DELETE' })
                                  .then(() => {
                                    toast.success(tCommon('deleted'));
                                    fetchLocations();
                                  })
                                  .catch((err) => toast.error(err.message));
                              }
                            }}
                            className="p-1.5 hover:bg-red-50 rounded text-red-500 transition-colors"
                            title={tCommon('delete')}
                          >
                            
                            <span className="material-symbols-outlined text-[18px]">delete</span>
                          </button>
                        </div>
                      )}
                      <span
                        className="text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded"
                        style={{
                          background: 'rgba(0,107,92,0.08)',
                          color: '#006b5c',
                          fontFamily: 'Manrope, sans-serif',
                        }}
                      >
                        {tLoc('zonesCount', { count: loc.zones.length })}
                      </span>
                      <span
                        className="text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded"
                        style={{
                          background: 'rgba(4,22,39,0.06)',
                          color: '#041627',
                          fontFamily: 'Manrope, sans-serif',
                        }}
                      >
                        {tLoc('binsCount', { count: binCount })}
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
                  </div>

                  {/* Zones */}
                  {isLocExpanded && (
                    <div className="border-t" style={{ borderColor: 'rgba(196,198,205,0.3)' }}>
                      {loc.zones.map((zone) => {
                        const isZoneExpanded = expandedZones.has(zone.zoneId);

                        return (
                          <div key={zone.zoneId}>
                            {/* Zone Row */}
                            <div
                              role="button"
                              tabIndex={0}
                              onClick={() => toggleZone(zone.zoneId)}
                              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleZone(zone.zoneId); } }}
                              className="w-full flex items-center gap-4 px-5 py-3 text-left hover:bg-[#f0faf8] transition-colors cursor-pointer"
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
                              <div className="flex items-center gap-3 shrink-0">
                                {canEdit && (
                                  <div className="flex items-center gap-1 pr-2 mr-2 border-r border-[rgba(196,198,205,0.3)]">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setEditingZone({ zone, locationId: loc.locationId });
                                        setIsZoneModalOpen(true);
                                      }}
                                      className="p-1.5 hover:bg-[#eef2f6] rounded text-[#475569] transition-colors"
                                    >
                                      
                                      <span className="material-symbols-outlined text-[16px]">edit</span>
                                    </button>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        if (confirm(tCommon('confirmDelete'))) {
                                          apiFetch(`/api/inventory/zones/${zone.zoneId}`, { method: 'DELETE' })
                                            .then(() => {
                                              toast.success(tCommon('deleted'));
                                              fetchLocations();
                                            })
                                            .catch((err) => toast.error(err.message));
                                        }
                                      }}
                                      className="p-1.5 hover:bg-red-50 rounded text-red-500 transition-colors"
                                    >
                                      
                                      <span className="material-symbols-outlined text-[16px]">delete</span>
                                    </button>
                                  </div>
                                )}
                                <span
                                  className="text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded shrink-0"
                                  style={{
                                    background: 'rgba(4,22,39,0.06)',
                                    color: '#041627',
                                  }}
                                >
                                    {tLoc('binsCount', { count: zone.bins.length })}
                                  </span>
                              </div>
                            </div>

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
                                          {tLoc('bins')}
                                        </th>
                                        <th
                                          className="text-left px-4 py-2 text-[11px] font-bold uppercase tracking-wider"
                                          style={{ color: 'var(--text-muted)', fontFamily: 'Manrope, sans-serif' }}
                                        >
                                          {tCommon('columns.type')}
                                        </th>
                                        <th
                                          className="text-center px-4 py-2 text-[11px] font-bold uppercase tracking-wider"
                                          style={{ color: 'var(--text-muted)', fontFamily: 'Manrope, sans-serif' }}
                                        >
                                          {tLoc('fields.flags')}
                                        </th>
                                        <th
                                          className="text-left px-4 py-2 text-[11px] font-bold uppercase tracking-wider"
                                          style={{ color: 'var(--text-muted)', fontFamily: 'Manrope, sans-serif' }}
                                        >
                                          {tCommon('columns.source')}
                                        </th>
                                        {canEdit && <th className="w-10 px-4 py-2"></th>}
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
                                                  {tLoc('consignmentShort')}
                                                </span>
                                              )}
                                              {bin.isBonded && (
                                                <span
                                                  className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                                                  style={{ background: 'rgba(245,158,11,0.1)', color: '#b45309' }}
                                                >
                                                  {tLoc('bondedShort')}
                                                </span>
                                              )}
                                              {bin.isUnavailable && (
                                                <span
                                                  className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                                                  style={{ background: 'rgba(239,68,68,0.1)', color: '#dc2626' }}
                                                >
                                                  {tCommon('na')}
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
                                          {canEdit && (
                                            <td className="px-2 py-2">
                                              <div className="flex items-center gap-1">
                                                <button
                                                  onClick={() => {
                                                    setEditingBin({ bin, zoneId: zone.zoneId });
                                                    setIsBinModalOpen(true);
                                                  }}
                                                  className="p-1 hover:bg-[#eef2f6] rounded text-[#475569] transition-colors"
                                                >
                                                  
                                                  <span className="material-symbols-outlined text-[16px]">edit</span>
                                                </button>
                                                <button
                                                  onClick={() => {
                                                    if (confirm(tCommon('confirmDelete'))) {
                                                      apiFetch(`/api/inventory/bins/${bin.binId}`, { method: 'DELETE' })
                                                        .then(() => {
                                                          toast.success(tCommon('deleted'));
                                                          fetchLocations();
                                                        })
                                                        .catch((err) => toast.error(err.message));
                                                    }
                                                  }}
                                                  className="p-1 hover:bg-red-50 rounded text-red-500 transition-colors"
                                                >
                                                  
                                                  <span className="material-symbols-outlined text-[16px]">delete</span>
                                                </button>
                                              </div>
                                            </td>
                                          )}
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                  {canEdit && (
                                    <div className="px-4 py-2 bg-slate-50 border-t border-[rgba(196,198,205,0.2)]">
                                      <button
                                        onClick={() => {
                                          setEditingBin({ zoneId: zone.zoneId });
                                          setIsBinModalOpen(true);
                                        }}
                                        className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1.5 transition-colors"
                                      >
                                        
                                        <span className="material-symbols-outlined text-[16px]">add_circle</span>
                                        <span>{tLoc('addBinTo', { name: zone.code })}</span>
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}

                            {isZoneExpanded && zone.bins.length === 0 && (
                              <div style={{ paddingLeft: 80 }} className="pb-3 pr-5">
                                <p className="text-sm italic mb-2" style={{ color: 'var(--text-muted)' }}>
                                  {tLoc('noBinsInZone')}
                                </p>
                                {canEdit && (
                                  <button
                                    onClick={() => {
                                      setEditingBin({ zoneId: zone.zoneId });
                                      setIsBinModalOpen(true);
                                    }}
                                    className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1.5 transition-colors"
                                  >
                                    
                                    <span className="material-symbols-outlined text-[16px]">add_circle</span>
                                    <span>{tLoc('addBinTo', { name: zone.code })}</span>
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                      {canEdit && (
                        <div className="py-3 px-12 border-t border-[rgba(196,198,205,0.2)] bg-[#fdfdfd]">
                          <button
                            onClick={() => {
                              setEditingZone({ locationId: loc.locationId });
                              setIsZoneModalOpen(true);
                            }}
                            className="text-xs font-bold text-emerald-600 hover:text-emerald-800 flex items-center gap-2 transition-colors uppercase tracking-wide"
                          >
                            
                            <span className="material-symbols-outlined text-[18px]">add_circle</span>
                            <span>{tLoc('addZoneTo', { name: loc.code })}</span>
                          </button>
                        </div>
                      )}
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
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({ code: '', name: '', city: '', country: '' });

  useEffect(() => {
    if (editingLocation) {
      setFormData({ 
        code: editingLocation.code, 
        name: editingLocation.name, 
        city: editingLocation.city || '', 
        country: editingLocation.country || '' 
      });
    } else {
      setFormData({ code: '', name: '', city: '', country: '' });
    }
  }, [editingLocation, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const method = editingLocation ? 'PATCH' : 'POST';
    const url = editingLocation ? `/api/inventory/locations/${editingLocation.locationId}` : '/api/inventory/locations';
    
    try {
      await apiFetch(url, { method, body: JSON.stringify(formData) });
      toast.success(editingLocation ? t('updated') : t('created'));
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.message);
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
          <label className="text-[11px] font-bold uppercase tracking-wider text-[#041627]">{t('columns.code')}</label>
          <input 
            className="input" 
            required 
            value={formData.code} 
            onChange={e => setFormData({...formData, code: e.target.value.toUpperCase()})}
            placeholder="e.g. SYD01"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-bold uppercase tracking-wider text-[#041627]">{t('columns.name')}</label>
          <input 
            className="input" 
            required 
            value={formData.name} 
            onChange={e => setFormData({...formData, name: e.target.value})}
            placeholder="e.g. Sydney Warehouse"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-bold uppercase tracking-wider text-[#041627]">{tLoc('fields.city')}</label>
          <input 
            className="input" 
            value={formData.city} 
            onChange={e => setFormData({...formData, city: e.target.value})}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-bold uppercase tracking-wider text-[#041627]">{tLoc('fields.country')}</label>
          <input 
            className="input" 
            value={formData.country} 
            onChange={e => setFormData({...formData, country: e.target.value})}
          />
        </div>
        <button type="submit" disabled={loading} className="btn btn-primary mt-4 py-3 text-sm font-bold uppercase tracking-wider">
          {loading ? t('loading') : editingLocation ? t('save') : t('create')}
        </button>
      </form>
    </SlideOver>
  );
}

function ZoneModal({ isOpen, onClose, onSuccess, initialData }: { isOpen: boolean; onClose: () => void; onSuccess: () => void; initialData: { zone?: Zone; locationId: string } | null }) {
  const t = useTranslations('common');
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
    const method = initialData.zone ? 'PATCH' : 'POST';
    const url = initialData.zone ? `/api/inventory/zones/${initialData.zone.zoneId}` : '/api/inventory/zones';
    const body = initialData.zone ? formData : { ...formData, locationId: initialData.locationId };
    
    try {
      await apiFetch(url, { method, body: JSON.stringify(body) });
      toast.success(initialData.zone ? t('updated') : t('created'));
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.message);
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
          <label className="text-[11px] font-bold uppercase tracking-wider text-[#041627]">{tLoc('fields.zoneCode')}</label>
          <input 
            className="input" 
            required 
            value={formData.code} 
            onChange={e => setFormData({...formData, code: e.target.value.toUpperCase()})}
            placeholder="e.g. BULK"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-bold uppercase tracking-wider text-[#041627]">{tLoc('fields.zoneName')}</label>
          <input 
            className="input" 
            required 
            value={formData.name} 
            onChange={e => setFormData({...formData, name: e.target.value})}
            placeholder="e.g. Bulk Storage"
          />
        </div>
        <button type="submit" disabled={loading} className="btn btn-primary mt-4 py-3 text-sm font-bold uppercase tracking-wider">
          {loading ? '...' : initialData?.zone ? t('save') : t('create')}
        </button>
      </form>
    </SlideOver>
  );
}

function BinModal({ isOpen, onClose, onSuccess, initialData }: { isOpen: boolean; onClose: () => void; onSuccess: () => void; initialData: { bin?: Bin; zoneId: string } | null }) {
  const tCommon = useTranslations('common');
  const tLoc = useTranslations('inventory.locations');
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({ binNumber: '', binType: '', isConsignment: false, isBonded: false, isUnavailable: false });

  useEffect(() => {
    if (initialData?.bin) {
      setFormData({ 
        binNumber: initialData.bin.binNumber, 
        binType: initialData.bin.binType || '',
        isConsignment: initialData.bin.isConsignment,
        isBonded: initialData.bin.isBonded,
        isUnavailable: initialData.bin.isUnavailable
      });
    } else {
      setFormData({ binNumber: '', binType: '', isConsignment: false, isBonded: false, isUnavailable: false });
    }
  }, [initialData, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!initialData) return;
    setLoading(true);
    const method = initialData.bin ? 'PATCH' : 'POST';
    const url = initialData.bin ? `/api/inventory/bins/${initialData.bin.binId}` : '/api/inventory/bins';
    const body = initialData.bin ? formData : { ...formData, zoneId: initialData.zoneId };
    
    try {
      await apiFetch(url, { method, body: JSON.stringify(body) });
      toast.success(initialData.bin ? tCommon('updated') : tCommon('created'));
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.message);
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
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-bold uppercase tracking-wider text-[#041627]">{tLoc('fields.binNumber')}</label>
          <input 
            className="input" 
            required 
            value={formData.binNumber} 
            onChange={e => setFormData({...formData, binNumber: e.target.value.toUpperCase()})}
            placeholder={tLoc('placeholders.binNumber')}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-bold uppercase tracking-wider text-[#041627]">{tLoc('fields.binType')}</label>
          <input 
            className="input" 
            value={formData.binType} 
            onChange={e => setFormData({...formData, binType: e.target.value})}
            placeholder={tLoc('placeholders.binType')}
          />
        </div>
        <div className="flex flex-col gap-3 pt-2">
          <label className="flex items-center gap-3 cursor-pointer group">
            <input 
              type="checkbox" 
              checked={formData.isConsignment} 
              onChange={e => setFormData({...formData, isConsignment: e.target.checked})}
              className="checkbox-blue"
            />
            <span className="text-sm font-medium text-[#041627]">{tLoc('fields.consignment')}</span>
          </label>
          <label className="flex items-center gap-3 cursor-pointer group">
            <input 
              type="checkbox" 
              checked={formData.isBonded} 
              onChange={e => setFormData({...formData, isBonded: e.target.checked})}
              className="checkbox-blue"
            />
            <span className="text-sm font-medium text-[#041627]">{tLoc('fields.bonded')}</span>
          </label>
          <label className="flex items-center gap-3 cursor-pointer group">
            <input 
              type="checkbox" 
              checked={formData.isUnavailable} 
              onChange={e => setFormData({...formData, isUnavailable: e.target.checked})}
              className="checkbox-blue"
            />
            <span className="text-sm font-medium text-[#041627]">{tLoc('fields.unavailable')}</span>
          </label>
        </div>
        <button type="submit" disabled={loading} className="btn btn-primary mt-4 py-3 text-sm font-bold uppercase tracking-wider">
          {loading ? tCommon('loading') : initialData?.bin ? tCommon('save') : tCommon('create')}
        </button>
      </form>
    </SlideOver>
  );
}

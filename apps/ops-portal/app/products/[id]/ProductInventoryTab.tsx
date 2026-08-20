import { useState, useMemo, Fragment, useEffect } from 'react';
import { reportError } from '@/lib/api';
import { toast } from 'react-hot-toast';
import { useTranslations } from 'next-intl';
import * as api from '@herobm/sdk';
import { getErrorMessage, compareBinNumbers } from '@herobm/shared';
import { Button } from '@/components/shared/Button';
import { formatLocationDisplay, formatQuantity } from '@/lib/formatters';

interface ProductInventoryTabProps {
  productId: string;
  product: api.ProductResponseDto;
  isEditable: boolean;
  onRefresh: () => Promise<void>;
}

interface KitComponentItem {
  childProductId: string;
  parentQuantity?: number;
  productNumber?: string;
  name?: string;
}

export function ProductInventoryTab({
  productId,
  product,
  isEditable,
  onRefresh
}: ProductInventoryTabProps) {
  const t = useTranslations();
  const tCommon = useTranslations('common');

  const [locations, setLocations] = useState<api.InventoryLocationResponseDto[]>([]);
  const [addingBinLink, setAddingBinLink] = useState(false);
  const [newBinLink, setNewBinLink] = useState({ locationId: '', binId: '', isPrimaryPerLocation: true, minQty: '', maxQty: '' });
  const [editingBinId, setEditingBinId] = useState<string | null>(null);
  const [editingBinData, setEditingBinData] = useState({ locationId: '', binId: '', isPrimaryPerLocation: true, minQty: '', maxQty: '' });
  const [availableBins, setAvailableBins] = useState<api.InventoryBinResponseDto[]>([]);
  const [saving, setSaving] = useState(false);
  const [inventoryLevels, setInventoryLevels] = useState<api.InventoryResponseDto[]>([]);
  const [buildableQuantity, setBuildableQuantity] = useState<number | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<string>('');
  const [kitComponents, setKitComponents] = useState<KitComponentItem[]>([]);

  useEffect(() => {
    const fetchInventoryData = async () => {
      try {
        let productIdsToFetch: string[] = [productId];
        let kitComponentsList: KitComponentItem[] = [];
        
        if (product?.structureType === 'kit') {
          const componentsData = await api.productsControllerGetComponents(productId);
          const comps = (componentsData.data && 'data' in (componentsData.data as object) ? (componentsData.data as { data: unknown }).data : componentsData.data) as KitComponentItem[];
          if (comps?.length) {
            kitComponentsList = comps;
            setKitComponents(comps);
            productIdsToFetch = [productId, ...comps.map((c) => c.childProductId).filter(Boolean)];
          }
        }
        
        const invDataRes = await api.inventoryControllerFindByProductIdsBulk({ productIds: productIdsToFetch });
        const invLevels = invDataRes?.data || [];
        setInventoryLevels(invLevels);
        
        if (product?.structureType === 'kit' && kitComponentsList.length && invLevels.length) {
          // Group inventory by location to ensure we only count kits that can be physically built at a single site
          const inventoryByLocation: Record<string, Record<string, number>> = {};
          invLevels.forEach(lvl => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Complex UI state, DTO typing
            const locationId = (lvl as any).locationId;
            if (!locationId) return;
            if (!inventoryByLocation[locationId]) inventoryByLocation[locationId] = {};
            inventoryByLocation[locationId][lvl.productId] = (inventoryByLocation[locationId][lvl.productId] || 0) + (parseFloat(lvl.quantityAvailable as string) || 0);
          });

          let totalBuildable = 0;
          for (const locId in inventoryByLocation) {
            const locInv = inventoryByLocation[locId];
            const maxBuildableAtLoc = kitComponentsList.map(c => {
              // Ensure we don't calculate negative buildable quantities if stock is negative
              const available = Math.max(0, locInv[c.childProductId] || 0);
              return Math.floor(available / (c.parentQuantity || 1));
            });
            totalBuildable += Math.min(...maxBuildableAtLoc);
          }
          setBuildableQuantity(totalBuildable);
        } else {
          setBuildableQuantity(null);
        }
      } catch (err) {
        reportError(err, 'ProductInventoryTab');
      }
    };
    
    fetchInventoryData();
  }, [productId, product?.structureType]);

  useEffect(() => {
    api.inventoryControllerFindAllLocations({ productId })
      .then((res) => setLocations(res.data || []))
      .catch(console.error);
  }, [productId]);

  useEffect(() => {
    if (!newBinLink.locationId) {
      setAvailableBins([]);
      return;
    }
    api.inventoryControllerFindBinsByLocation(newBinLink.locationId)
      .then(res => {
        const bins = res.data || [];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Complex UI state, DTO typing, or Material Icon
        bins.sort((a: any, b: any) => compareBinNumbers(a.binNumber, b.binNumber));
        setAvailableBins(bins);
      })
      .catch(console.error);
  }, [newBinLink.locationId]);

  
  const filteredBuildableQuantity = useMemo(() => {
    if (product?.structureType !== 'kit' || !kitComponents.length || !inventoryLevels.length) return null;
    
    const inventoryByLocation: Record<string, Record<string, number>> = {};
    inventoryLevels.forEach(lvl => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Complex UI state, DTO typing
      const locationId = (lvl as any).locationId;
      if (!locationId) return;
      if (!inventoryByLocation[locationId]) inventoryByLocation[locationId] = {};
      inventoryByLocation[locationId][lvl.productId] = (inventoryByLocation[locationId][lvl.productId] || 0) + (parseFloat(lvl.quantityAvailable as string) || 0);
    });

    let totalBuildable = 0;
    for (const locId in inventoryByLocation) {
      if (selectedLocation && selectedLocation !== locId) continue;
      const locInv = inventoryByLocation[locId];
      const maxBuildableAtLoc = kitComponents.map(c => {
        const available = Math.max(0, locInv[c.childProductId] || 0);
        return Math.floor(available / (c.parentQuantity || 1));
      });
      totalBuildable += Math.min(...maxBuildableAtLoc);
    }
    return totalBuildable;
  }, [product?.structureType, kitComponents, inventoryLevels, selectedLocation]);

  const unifiedInventory = useMemo(() => {
    if (!product || !inventoryLevels) return [];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Complex UI state, DTO typing, or Material Icon
    const locMap = new Map<string, any>();

    inventoryLevels.forEach(lvl => {
      const loc = {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Complex UI state, DTO typing, or Material Icon
        locationId: (lvl as any).locationId,
        locationNo: lvl.locationNo,
        locationName: lvl.locationName,
        quantityOnHand: lvl.quantityOnHand || 0,
        quantityCommitted: lvl.quantityCommitted || 0,
        quantityAvailable: lvl.quantityAvailable || 0,
        quantityOnOrder: lvl.quantityOnOrder || 0,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Complex UI state, DTO typing, or Material Icon
        bins: new Map<string, any>()
      };
      
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Complex UI state, DTO typing, or Material Icon
      ((lvl as any).binBalances || []).forEach((b: any) => {
        loc.bins.set(b.binId, { ...b, isDefault: false });
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Complex UI state, DTO typing, or Material Icon
      locMap.set((lvl as any).locationId, loc);
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Complex UI state, DTO typing, or Material Icon
    ((product as any).defaultBins || []).forEach((db: any) => {
      let loc = locMap.get(db.locationId);
      if (!loc) {
        loc = {
          locationId: db.locationId,
          locationNo: db.locationNo || 'Unknown',
          locationName: db.locationName || 'Unknown Location',
          quantityOnHand: 0,
          quantityCommitted: 0,
          quantityAvailable: 0,
          quantityOnOrder: 0,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Complex UI state, DTO typing, or Material Icon
          bins: new Map<string, any>()
        };
        locMap.set(db.locationId, loc);
      }
      
      let bin = loc.bins.get(db.binId);
      if (!bin) {
        bin = {
          binId: db.binId,
          binNumber: db.binNumber,
          quantityOnHand: db.quantityOnHand || 0,
        };
        loc.bins.set(db.binId, bin);
      }
      bin.isDefault = true;
      bin.isPrimary = db.isPrimaryPerLocation;
      bin.productDefaultBinId = db.productDefaultBinId;
    });

    return Array.from(locMap.values())
      .map(loc => ({
        ...loc,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Complex UI state, DTO typing, or Material Icon
        bins: Array.from(loc.bins.values()).sort((a: any, b: any) => {
          if (a.isPrimary) return -1;
          if (b.isPrimary) return 1;
          return (a.binNumber || '').localeCompare(b.binNumber || '');
        })
      }))
      .sort((a, b) => a.locationNo?.localeCompare(b.locationNo));

  }, [inventoryLevels, product]);

  return (
    <div className="w-full pb-6">
      <div className="z-10 bg-white rounded-xl border border-[rgba(196,198,205,0.4)] overflow-hidden transition-all">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[rgba(196,198,205,0.4)]">
          <div className="flex items-center gap-4 flex-1">
            <h2 className="text-[1.3rem] font-bold tracking-tight text-[#041627] shrink-0 font-['Manrope',sans-serif]">
              {t('products.inventoryLevels')}
              {product?.productType === 'non-stock' && filteredBuildableQuantity !== null && (
                <span className="ml-3 badge badge-success text-[13px] font-bold">
                  {t('products.availableToAssemble', { quantity: filteredBuildableQuantity })}
                </span>
              )}
            </h2>
          </div>
          {!addingBinLink && isEditable && product?.productType !== 'non-stock' && (
            <Button
              size="sm"
              variant="primary"
              className="bg-[#006b5c] hover:bg-[#005246] border-none text-white flex items-center gap-1.5"
              onClick={() => setAddingBinLink(true)}
              disabled={saving}
            >
              {t('products.storage.addBinLink')}
            </Button>
          )}
        </div>

        {addingBinLink && (
          <div className="flex flex-wrap items-end gap-3 p-5 border-b border-gray-100 bg-white">
            <div className="flex-[1_1_200px]">
              <label className="block text-xs font-medium mb-1 text-[var(--text-muted)]">{t('products.storage.columns.location')}</label>
              <select
                className="input w-full"
                value={newBinLink.locationId}
                onChange={(e) => setNewBinLink({ ...newBinLink, locationId: e.target.value, binId: '' })}
              >
                <option value="">{t('common.selectEllipsis')}</option>
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any -- Complex UI state, DTO typing, or Material Icon */}
                {locations.map((loc: any) => (
                  <option key={loc.locationId} value={loc.locationId}>
                    {formatLocationDisplay(loc)}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex-[1_1_150px]">
              <label className="block text-xs font-medium mb-1 text-[var(--text-muted)]">{t('products.storage.columns.bin')}</label>
              <select
                className="input w-full"
                disabled={!newBinLink.locationId}
                value={newBinLink.binId}
                onChange={(e) => setNewBinLink({ ...newBinLink, binId: e.target.value })}
              >
                <option value="">{t('common.selectEllipsis')}</option>
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any -- Complex UI state, DTO typing, or Material Icon */}
                {availableBins.map((b: any) => (
                  <option key={b.binId} value={b.binId}>
                    {b.binNumber}
                  </option>
                ))}
              </select>
            </div>
            <div className="w-[90px]">
              <label className="block text-xs font-medium mb-1 text-[var(--text-muted)]">{t('products.storage.columns.minQty')}</label>
              <input
                className="input text-right"
                type="number"
                min="0"
                value={newBinLink.minQty}
                onChange={(e) => setNewBinLink({ ...newBinLink, minQty: e.target.value })}
              />
            </div>
            <div className="w-[90px]">
              <label className="block text-xs font-medium mb-1 text-[var(--text-muted)]">{t('products.storage.columns.maxQty')}</label>
              <input
                className="input text-right"
                type="number"
                min="0"
                value={newBinLink.maxQty}
                onChange={(e) => setNewBinLink({ ...newBinLink, maxQty: e.target.value })}
              />
            </div>
            <div className="w-[80px]">
              <label className="block text-xs font-medium mb-2 text-[var(--text-muted)]">{t('products.storage.columns.primary')}</label>
              <label className="switch mt-1">
                <input 
                  type="checkbox" 
                  checked={newBinLink.isPrimaryPerLocation}
                  onChange={(e) => setNewBinLink({ ...newBinLink, isPrimaryPerLocation: e.target.checked })}
                />
                <span className="switch-slider"></span>
              </label>
            </div>
            
            <div className="flex gap-2.5">
              <Button
                size="sm"
                variant="ghost"
                className="text-[#64748b] hover:bg-[#f1f5f9]"
                onClick={() => {
                  setAddingBinLink(false);
                  setNewBinLink({ locationId: '', binId: '', isPrimaryPerLocation: false, minQty: '', maxQty: '' });
                }}
                disabled={saving}
              >
                {tCommon('buttons.cancel')}
              </Button>
              <Button
                size="sm"
                variant="primary"
                className="bg-[#006b5c] hover:bg-[#005246] border-none px-6"
                disabled={!newBinLink.locationId || !newBinLink.binId || saving}
                onClick={async () => {
                  try {
                    setSaving(true);
                    await api.productsControllerLinkDefaultBin(productId, newBinLink);
                    toast.success(t('products.storage.toastLinkAdded'));
                    setAddingBinLink(false);
                    setNewBinLink({ locationId: '', binId: '', isPrimaryPerLocation: false, minQty: '', maxQty: '' });
                    await onRefresh();
                  } catch (err: unknown) {
                    toast.error(getErrorMessage(err));
                  } finally {
                    setSaving(false);
                  }
                }}
              >
                {tCommon('buttons.save')}
              </Button>
            </div>
          </div>
        )}

        <div className="overflow-x-auto">
          {product?.structureType === 'kit' && product?.productType === 'non-stock' ? (
            <>
              <div className="flex justify-end px-6 py-4 border-b border-[rgba(196,198,205,0.4)]">
                <select 
                  className="input input-sm w-64" 
                  value={selectedLocation} 
                  onChange={(e) => setSelectedLocation(e.target.value)}
                >
                  <option value="">{t('common.filters.allLocations')}</option>
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any -- Complex UI state, DTO typing, or Material Icon */}
                  {locations.map((loc: any) => (
                    <option key={loc.locationId} value={loc.locationId}>{formatLocationDisplay(loc)}</option>
                  ))}
                </select>
              </div>
              <table className="w-full text-left border-collapse text-[13px]">
              <thead className="bg-[#f9fafb] sticky top-0 z-10">
                <tr className="border-b border-[var(--border)]">
                  <th className="py-2 px-6 font-semibold text-[#64748b] text-[11px] uppercase tracking-wider">{t('products.tabs.kitComponents')} / {t('products.columns.productNumber')}</th>
                  <th className="py-2 px-4 font-semibold text-[#64748b] text-[11px] uppercase tracking-wider text-right">{t('products.columns.quantity')}</th>
                  <th className="py-2 px-4 font-semibold text-[#64748b] text-[11px] uppercase tracking-wider text-right">{t('inventory.columns.available')}</th>
                </tr>
              </thead>
              <tbody className="[&_tr:last-child]:border-b-0">
                {kitComponents.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="py-8 text-center text-[#64748b] text-sm">{t('common.noMatchingResults')}</td>
                  </tr>
                ) : (
                  kitComponents.map(comp => {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Complex UI state, DTO typing, or Material Icon
                    const compInv = inventoryLevels.filter(l => l.productId === comp.childProductId && (!selectedLocation || (l as any).locationId === selectedLocation));
                    const totalAvail = compInv.reduce((sum, l) => sum + (parseFloat(l.quantityAvailable as string) || 0), 0);
                    return (
                      <tr key={comp.childProductId} className="bg-white border-b border-[#e2e8f0]">
                        <td className="py-3 px-6">
                          <div className="text-[#0f172a]">{comp.productNumber || tCommon('unknown')} - {comp.name || tCommon('unknown')}</div>
                        </td>
                        <td className="py-3 px-4 text-right font-medium text-[#475569]">{formatQuantity(comp.parentQuantity || 1)}</td>
                        <td className="py-3 px-4 text-right font-semibold text-[#006b5c]">{formatQuantity(totalAvail)}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
            </>
          ) : (
            <table className="w-full text-left border-collapse text-[13px]">
            <thead className="bg-[#f9fafb] sticky top-0 z-10">
              <tr className="border-b border-[var(--border)]">
                <th className="py-2 px-6 font-semibold text-[#64748b] text-[11px] uppercase tracking-wider">{tCommon('columns.location')}</th>
                <th className="py-2 px-4 font-semibold text-[#64748b] text-[11px] uppercase tracking-wider">{t('products.storage.columns.bin')}</th>
                <th className="py-2 px-4 font-semibold text-[#64748b] text-[11px] uppercase tracking-wider text-right">{t('products.storage.columns.minQty')}</th>
                <th className="py-2 px-4 font-semibold text-[#64748b] text-[11px] uppercase tracking-wider text-right">{t('products.storage.columns.maxQty')}</th>
                <th className="py-2 px-4 font-semibold text-[#64748b] text-[11px] uppercase tracking-wider text-right">{t('products.columns.quantityOnHand')}</th>
                <th className="py-2 px-4 font-semibold text-[#64748b] text-[11px] uppercase tracking-wider text-right">{t('inventory.columns.committed')}</th>
                <th className="py-2 px-4 font-semibold text-[#64748b] text-[11px] uppercase tracking-wider text-right">{t('inventory.columns.available')}</th>
                <th className="py-2 px-4 font-semibold text-[#64748b] text-[11px] uppercase tracking-wider text-right">{t('inventory.columns.onOrder')}</th>
                <th className="w-[90px]"></th>
              </tr>
            </thead>
            <tbody className="[&_tr:last-child]:border-b-0">
              {unifiedInventory.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-[#64748b] text-sm">{t('common.noMatchingResults')}</td>
                </tr>
              ) : (
                unifiedInventory.map((lvl) => (
                  <Fragment key={lvl.locationId}>
                    <tr className="bg-[#f1f5f9] border-b border-[#e2e8f0]">
                      <td className="py-2 px-6 font-bold text-[#0f172a]" colSpan={4}>
                        {lvl.locationName} <span className="text-[#64748b] ml-1 font-semibold">({lvl.locationNo})</span>
                      </td>
                      <td className="py-2 px-4 font-bold text-[#0f172a] text-right tabular-nums">{formatQuantity(lvl.quantityOnHand)}</td>
                      <td className="py-2 px-4 font-bold text-[#0f172a] text-right tabular-nums">{formatQuantity(lvl.quantityCommitted)}</td>
                      <td className="py-2 px-4 font-bold text-[#006b5c] text-right tabular-nums">{formatQuantity(lvl.quantityAvailable)}</td>
                      <td className="py-2 px-4 font-bold text-[#0f172a] text-right tabular-nums">{formatQuantity(lvl.quantityOnOrder)}</td>
                      <td></td>
                    </tr>
                    {lvl.bins.length === 0 ? (
                      <tr className="border-b border-[#e2e8f0]">
                        <td className="py-2 px-6"></td>
                        <td className="py-2 px-4 text-[#64748b] italic text-xs" colSpan={8}>{t('products.storage.noBins')}</td>
                      </tr>
                    ) : (
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Complex UI state, DTO typing, or Material Icon
                      Array.from(lvl.bins.values()).map((bin: any) => editingBinId === bin.binId ? (
                        <tr key={bin.binId} className="bg-white border-b border-[#e2e8f0]">
                          <td className="py-2 px-6"></td>
                          <td className="py-2 px-4">
                            <span className="font-semibold text-[#334155]">{bin.binNumber}</span>
                          </td>
                          <td className="py-2 px-4">
                            <input
                              className="input input-sm w-full text-right h-[32px]"
                              type="number"
                              min="0"
                              value={editingBinData.minQty}
                              onChange={(e) => setEditingBinData({ ...editingBinData, minQty: e.target.value })}
                            />
                          </td>
                          <td className="py-2 px-4">
                            <input
                              className="input input-sm w-full text-right h-[32px]"
                              type="number"
                              min="0"
                              value={editingBinData.maxQty}
                              onChange={(e) => setEditingBinData({ ...editingBinData, maxQty: e.target.value })}
                            />
                          </td>
                          <td colSpan={4} className="py-2 px-4">
                            <div className="flex items-center gap-2 pt-1">
                              <label className="switch">
                                <input 
                                  type="checkbox" 
                                  checked={editingBinData.isPrimaryPerLocation}
                                  onChange={(e) => setEditingBinData({ ...editingBinData, isPrimaryPerLocation: e.target.checked })}
                                />
                                <span className="switch-slider"></span>
                              </label>
                              <span className="text-xs text-[#64748b] font-medium leading-none mt-[-2px]">{t('products.storage.columns.primary')}</span>
                            </div>
                          </td>
                          <td className="py-2 px-4 text-right">
                            <div className="flex justify-end gap-1">
                              <Button onClick={() => setEditingBinId(null)} size="xs" variant="ghost" className="px-1.5" title={tCommon('buttons.cancel')}>

                                <span className="material-symbols-outlined text-[16px] text-gray-500">close</span>
                              </Button>
                              <Button 
                                size="xs"
                                variant="primary"
                                className="bg-[#006b5c] border-none px-1.5"
                                onClick={async () => {
                                  try {
                                    setSaving(true);
                                    await api.productsControllerLinkDefaultBin(productId, editingBinData);
                                    toast.success(t('products.storage.toastLinkUpdated'));
                                    setEditingBinId(null);
                                    await onRefresh();
                                  } catch (err: unknown) {
                                    toast.error(getErrorMessage(err));
                                  } finally {
                                    setSaving(false);
                                  }
                                }}
                                title={tCommon('buttons.save')}
                                disabled={saving}
                              >
                                { }
                                <span className="material-symbols-outlined text-[16px]">check</span>
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        <tr key={bin.binId} className="border-b border-[#e2e8f0] hover:bg-[#f8fafc]">
                          <td className="py-2 px-6"></td>
                          <td className="py-2 px-4">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-[#334155]">
                                {bin.binNumber}
                              </span>
                              {bin.isPrimary && (
                                <span title="Primary Bin" className="text-[10px] font-bold text-[#64748b] bg-[#e2e8f0] px-1.5 py-0.5 rounded leading-tight cursor-help mt-[1px]">P</span>
                              )}
                            </div>
                          </td>
                          <td className="py-2 px-4 text-[#475569] text-right tabular-nums">{bin.isDefault ? (bin.minQty !== undefined && bin.minQty !== null && bin.minQty !== '' ? formatQuantity(bin.minQty) : '0') : '—'}</td>
                          <td className="py-2 px-4 text-[#475569] text-right tabular-nums">{bin.isDefault ? (bin.maxQty !== undefined && bin.maxQty !== null && bin.maxQty !== '' ? formatQuantity(bin.maxQty) : '0') : '—'}</td>
                          <td className="py-2 px-4 font-medium text-[#475569] text-right tabular-nums">{formatQuantity(bin.quantityOnHand)}</td>
                          <td colSpan={3}></td>
                          <td className="py-2 px-4 text-center">
                            {isEditable && (
                              <div className="flex items-center justify-end gap-1">
                                <Button variant="ghost"
                                  onClick={() => {
                                    setEditingBinId(bin.binId);
                                    setEditingBinData({
                                      locationId: lvl.locationId,
                                      binId: bin.binId,
                                      isPrimaryPerLocation: bin.isPrimary || false,
                                      minQty: bin.minQty || '',
                                      maxQty: bin.maxQty || '',
                                    });
                                  }}
                                  className="p-1 hover:bg-[#eef2f6] rounded text-[#475569] transition-colors"
                                >
                                  { }
                                  <span className="material-symbols-outlined text-[16px]">edit</span>
                                </Button>
                                {bin.isDefault && (
                                  <Button variant="ghost"
                                    onClick={async () => {
                                      if (!window.confirm(t('products.storage.confirmRemoveLink', { bin: bin.binNumber, location: lvl.locationName }))) return;
                                      try {
                                        setSaving(true);
                                        await api.productsControllerRemoveDefaultBin(productId, bin.productDefaultBinId);
                                        toast.success(t('products.storage.toastLinkRemoved'));
                                        await onRefresh();
                                      } catch (err: unknown) {
                                        toast.error(getErrorMessage(err));
                                      } finally {
                                        setSaving(false);
                                      }
                                    }}
                                    className="p-1 hover:bg-red-50 rounded text-red-500 transition-colors"
                                  >
                                    { }
                                    <span className="material-symbols-outlined text-[16px]">delete</span>
                                  </Button>
                                )}
                              </div>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </Fragment>
                ))
              )}
            </tbody>
          </table>
          )}
        </div>
      </div>
    </div>
  );
}

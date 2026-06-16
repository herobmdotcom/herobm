'use client';

import { useState, useMemo, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { reportError } from '@/lib/api';
import * as api from '@herobm/sdk';
import toast from 'react-hot-toast';
import SupplierSelect from '@/components/shared/SupplierSelect';

interface DemandRow {
  id: string;
  salesOrderId: string;
  orderNumber: string;
  productId: string;
  productName: string;
  productDescription?: string;
  quantity: number;
  createdOn: string;
  vendorId?: string;
  vendorName?: string;
  costPrice?: number;
  currencyCode?: string;
  locationId: string;
  locationName: string;
}

interface DraftPOsModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedDemands: DemandRow[];
  onSuccess: () => void;
}

export default function DraftPOsModal({ isOpen, onClose, selectedDemands, onSuccess }: DraftPOsModalProps) {
  const t = useTranslations('purchaseOrders');
  const [loading, setLoading] = useState(false);

  // Local state to track which vendor each line is assigned to
  // Format: { [demandId]: { vendorId, vendorName, costPrice, currencyCode } }
  const [lineAssignments, setLineAssignments] = useState<Record<string, { vendorId: string | undefined, vendorName: string, costPrice: number, currencyCode: string }>>({});

  useEffect(() => {
    if (isOpen) {
      // Initialize line assignments based on preferred suppliers
      const initial: typeof lineAssignments = {};
      selectedDemands.forEach(d => {
        initial[d.id] = {
          vendorId: d.vendorId,
          vendorName: d.vendorName || 'Unassigned',
          costPrice: d.costPrice || 0,
          currencyCode: d.currencyCode || 'EUR'
        };
      });
      setLineAssignments(initial);
    }
  }, [isOpen, selectedDemands]);

  // Group demands by their currently assigned vendor and location
  const groupedDemands = useMemo(() => {
    const groups: Record<string, { vendorName: string, vendorId: string | undefined, locationId: string, locationName: string, demands: DemandRow[] }> = {};
    
    selectedDemands.forEach(demand => {
      const assignment = lineAssignments[demand.id] || {};
      const vId = assignment.vendorId || 'unassigned';
      const key = `${vId}_${demand.locationId}`;
      
      if (!groups[key]) {
        groups[key] = {
          vendorId: assignment.vendorId,
          vendorName: assignment.vendorName || 'Unassigned',
          locationId: demand.locationId,
          locationName: demand.locationName,
          demands: []
        };
      }
      groups[key].demands.push(demand);
    });
    
    return Object.values(groups);
  }, [selectedDemands, lineAssignments]);

  const handleGenerate = async () => {
    // Validate: No unassigned demands allowed
    const hasUnassigned = Object.values(lineAssignments).some(a => !a.vendorId);
    if (hasUnassigned) {
      toast.error(t('demands.allAssignedError'));
      return;
    }

    setLoading(true);
    try {
      // Build payload
      const posPayload = groupedDemands.filter(g => g.vendorId).map(group => {
        // Consolidate lines for the same product
        const linesMap = new Map<string, { productId: string, quantity: number, pricePerUnit: number, backorderIds: string[] }>();
        
        group.demands.forEach(d => {
          const assignment = lineAssignments[d.id];
          if (!linesMap.has(d.productId)) {
            linesMap.set(d.productId, {
              productId: d.productId,
              quantity: 0,
              pricePerUnit: assignment.costPrice || 0,
              backorderIds: []
            });
          }
          const line = linesMap.get(d.productId)!;
          line.quantity += d.quantity;
          line.backorderIds.push(d.id);
        });

        // Get unique SO numbers for notes
        const uniqueSoNumbers = Array.from(new Set(group.demands.map(d => d.orderNumber)));

        return {
          vendorId: group.vendorId || '',
          deliveryLocationId: group.locationId,
          currencyCode: group.demands[0] ? lineAssignments[group.demands[0].id]?.currencyCode : 'EUR',
          soNumbers: uniqueSoNumbers,
          lines: Array.from(linesMap.values()).map(l => ({ ...l, quantity: l.quantity.toString(), pricePerUnit: l.pricePerUnit.toString() }))
        };
      });

      await api.allocationsControllerGeneratePOs({ pos: posPayload });

      toast.success(t('demands.posGeneratedSuccess'));
      onSuccess();
    } catch (err) {
      reportError(err, 'DraftPOsModal');
      toast.error(t('demands.posGeneratedError'));
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50 rounded-t-xl">
          <div>
            <h2 className="text-xl font-bold text-gray-900">{t('demands.reviewDraftPos')}</h2>
            <p className="text-sm text-gray-500 mt-1">{t('demands.reviewDraftPosDesc')}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            {/* eslint-disable-next-line i18next/no-literal-string -- Material UI Icon */}
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="flex-1 overflow-auto p-6 space-y-6">
          {groupedDemands.map(group => (
            <div key={`${group.vendorId || 'unassigned'}_${group.locationId}`} className={`card mb-6 ${!group.vendorId ? 'border-red-400' : ''}`}>
              <div className="flex justify-between items-center mb-4">
                <h3 className={`section-heading ${!group.vendorId ? 'text-red-700' : ''}`}>
                  <span className="material-symbols-outlined">
                    {!group.vendorId ? t('demands.iconWarning') : t('demands.iconStorefront')}
                  </span>
                  {group.vendorId ? `Supplier: ${group.vendorName}` : t('demands.unassignedActionRequired')}
                  <span className="mx-2 text-gray-300">|</span>
                  { }
                  <span className="material-symbols-outlined text-[16px] text-gray-400">location_on</span>
                  <span className="font-normal text-gray-600 ml-1">{t('demands.deliverTo')} {group.locationName || t('demands.unknown')}</span>
                </h3>
                <span className="badge badge-legacy">
                  {t('demands.items', { count: group.demands.length })}
                </span>
              </div>
              <div className="overflow-visible">
                <table className="table-lines">
                  <thead>
                    <tr>
                      <th style={{ width: 120 }}>{t('demands.salesOrder')}</th>
                      <th style={{ width: 140 }}>{t('demands.product')}</th>
                      <th>{t('demands.description')}</th>
                      <th style={{ width: 90, textAlign: 'right' }}>{t('demands.reqQty')}</th>
                      <th style={{ width: 110, textAlign: 'right' }}>{t('demands.estCost')}</th>
                      <th style={{ width: 220 }}>{t('demands.supplierAssignment')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.demands.map(demand => {
                      const assign = lineAssignments[demand.id];
                      return (
                        <tr key={demand.id}>
                          <td style={{ fontWeight: 500 }}>{demand.orderNumber}</td>
                          <td style={{ fontWeight: 600, fontSize: 12, color: 'var(--accent)' }}>{demand.productName}</td>
                          <td style={{ color: 'var(--text-secondary)' }}>{demand.productDescription || '—'}</td>
                          <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{demand.quantity}</td>
                          <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                            {assign?.costPrice ? `${assign.costPrice.toFixed(2)} ${assign.currencyCode}` : '—'}
                          </td>
                          <td>
                            <SupplierSelect
                              value={assign?.vendorId || null}
                              initialSearchTerm={assign?.vendorName || ''}
                              placeholder={t('demands.selectSupplier')}
                              className={!assign?.vendorId ? 'border-red-400 bg-red-50 text-red-700' : ''}
                              onChange={(sup) => {
                                setLineAssignments(prev => ({
                                  ...prev,
                                  [demand.id]: {
                                    vendorId: sup?.vendorId,
                                    vendorName: sup?.name || 'Unassigned',
                                    costPrice: prev[demand.id]?.costPrice || 0, // Should be fetched in real system
                                    currencyCode: sup?.currencyCode || 'EUR'
                                  }
                                }));
                              }}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>

        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-end gap-3 rounded-b-xl">
          <button 
            onClick={onClose}
            className="btn btn-secondary"
          >
            {t('demands.cancel')}
          </button>
          <button 
            onClick={handleGenerate}
            disabled={loading}
            className="btn btn-primary flex items-center gap-2"
          >
            {loading && (
               
              <span className="material-symbols-outlined animate-spin text-[16px]">progress_activity</span>
            )}
            {t('demands.createDraftPos')}
          </button>
        </div>
      </div>
    </div>
  );
}

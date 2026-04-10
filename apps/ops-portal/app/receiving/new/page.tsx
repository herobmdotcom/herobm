'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { apiFetch, apiMutate } from '@/lib/api';
import { formatAmount } from '@/lib/currency';
import { toast } from 'react-hot-toast';
import ProductSearchInput from '@/components/shared/ProductSearchInput';
import type { Product } from '@/components/shared/ProductSearchInput';
import EntityHeader from '@/components/shared/EntityHeader';
import DetailsLayout from '@/components/shared/DetailsLayout';

import React, { useEffect } from 'react';
import LocationSelect from '@/components/shared/LocationSelect';
import { useTranslations } from 'next-intl';

interface PendingLine {
  purchaseOrderId: string;
  orderNumber: string;
  purchaseOrderName?: string;
  vendorName?: string;
  purchaseOrderLineId: string;
  lineNumber: number;
  productDescription: string;
  quantity: string;
  pricePerUnit: string;
  quantityReceived: string;
  currencyCode?: string;
}

interface DraftLine {
  id: string; // unique frontend ID
  purchaseOrderId: string;
  orderNumber: string;
  purchaseOrderLineId: string;
  productDescription: string;
  productId: string;
  productNumber?: string;
  quantityOrdered: number;
  quantityPreviouslyReceived: number;
  expectedPrice: number;
  quantityReceived: number;
  invoicePricePerUnit?: number;
  isQuarantine?: boolean;
  currencyCode?: string;
}

function ReceivingFlow() {
  const t = useTranslations('purchaseOrders.receptions');
  const tCommon = useTranslations('common');
  useDocumentTitle(t('flow.title'));
  const router = useRouter();
  const searchParams = useSearchParams();
  const poId = searchParams.get('poId');

  const [draftLines, setDraftLines] = useState<DraftLine[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [pendingLines, setPendingLines] = useState<PendingLine[]>([]);
  const [loadingLines, setLoadingLines] = useState(false);
  
  // Entry step state
  const [selectedLine, setSelectedLine] = useState<PendingLine | null>(null);
  const [qtyToReceive, setQtyToReceive] = useState<string>('');
  const [invoicePrice, setInvoicePrice] = useState<string>('');
  
  const [saving, setSaving] = useState(false);
  const [quarantineMode, setQuarantineMode] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [locationId, setLocationId] = useState<string | null>(null);
  const [notes, setNotes] = useState<string>('');
  const [packingSlipNumber, setPackingSlipNumber] = useState<string>('');
  const [finalDestinations, setFinalDestinations] = useState<any[]>([]);

  useEffect(() => {
    if (poId) {
      apiFetch<any>(`/api/purchase-orders/${poId}`)
        .then(data => {
          if (data.deliveryLocationId && !locationId) {
            setLocationId(data.deliveryLocationId);
          }
        })
        .catch(console.error);
    }
  }, [poId]);

  const handleProductSelect = async (product: Product) => {
    setSelectedProduct(product);
    setLoadingLines(true);
    setSelectedLine(null);
    setQuarantineMode(false);
    setPendingLines([]);
    setQtyToReceive('');
    setInvoicePrice('');
    
    try {
      const data = await apiFetch<PendingLine[]>(`/api/purchase-orders/pending-lines?productId=${product.productId}`);
      
      // Filter out lines that are already in the draft fully
      // But for simplicity, we just fetch state from server.
      setPendingLines(data);
      
      if (data.length === 1) {
        selectLine(data[0]);
      } else if (poId && data.some((l: any) => l.purchaseOrderId === poId)) {
         const matches = data.filter((l: any) => l.purchaseOrderId === poId);
         if (matches.length === 1) {
             selectLine(matches[0]);
         }
      }
    } catch (err: any) {
      toast.error(err.message || t('toast.failed'));
    } finally {
      setLoadingLines(false);
    }
  };

  const selectLine = (line: PendingLine) => {
    setSelectedLine(line);
    const prevReceived = Number(line.quantityReceived) || 0;
    
    // Check if we already have some in draft for this line
    const draftedQty = draftLines
        .filter(dl => dl.purchaseOrderLineId === line.purchaseOrderLineId)
        .reduce((sum, dl) => sum + dl.quantityReceived, 0);

    const remaining = Number(line.quantity) - prevReceived - draftedQty;
    
    setQtyToReceive(remaining > 0 ? remaining.toString() : '0');
    // Format to 2 decimals to ensure consistent UI rendering
    setInvoicePrice(parseFloat(line.pricePerUnit).toFixed(2));
  };

  const addToDraft = () => {
    if (!selectedLine || !selectedProduct) return;
    const qty = Number(qtyToReceive);
    if (qty <= 0) {
      toast.error(t('toast.qtyReq'));
      return;
    }
    
    setDraftLines([...draftLines, {
      id: Math.random().toString(36).substring(7),
      purchaseOrderId: selectedLine.purchaseOrderId,
      orderNumber: selectedLine.orderNumber,
      purchaseOrderLineId: selectedLine.purchaseOrderLineId,
      productDescription: selectedLine.productDescription,
      productId: selectedProduct.productId,
      productNumber: selectedProduct.productNumber,
      quantityOrdered: Number(selectedLine.quantity),
      quantityPreviouslyReceived: Number(selectedLine.quantityReceived),
      expectedPrice: Number(selectedLine.pricePerUnit),
      quantityReceived: qty,
      invoicePricePerUnit: invoicePrice ? Number(invoicePrice) : undefined,
      currencyCode: selectedLine.currencyCode
    }]);

    setSelectedProduct(null);
    setSelectedLine(null);
    setPendingLines([]);
    setQtyToReceive('');
    setInvoicePrice('');
  };

  const addQuarantineToDraft = () => {
    if (!selectedProduct) return;
    const qty = Number(qtyToReceive);
    if (qty <= 0) {
      toast.error(t('toast.qtyReq'));
      return;
    }
    
    setDraftLines([...draftLines, {
      id: Math.random().toString(36).substring(7),
      purchaseOrderId: 'QUARANTINE',
      orderNumber: 'Q-EXCEPTION',
      purchaseOrderLineId: 'QUARANTINE',
      productDescription: selectedProduct.name,
      productId: selectedProduct.productId,
      productNumber: selectedProduct.productNumber,
      quantityOrdered: 0,
      quantityPreviouslyReceived: 0,
      expectedPrice: 0,
      quantityReceived: qty,
      isQuarantine: true
    }]);

    setSelectedProduct(null);
    setQuarantineMode(false);
    setQtyToReceive('');
  };

  const removeDraftLine = (id: string) => {
    setDraftLines(draftLines.filter(l => l.id !== id));
  };

  const commitReceptions = async () => {
    if (draftLines.length === 0) return;
    if (!locationId) {
      toast.error(t('toast.selectLocation'));
      return;
    }
    setSaving(true);

    const validLines = draftLines.filter(l => !l.isQuarantine);

    const byPo = validLines.reduce((acc, curr) => {
      if (!acc[curr.purchaseOrderId]) acc[curr.purchaseOrderId] = [];
      acc[curr.purchaseOrderId].push(curr);
      return acc;
    }, {} as Record<string, DraftLine[]>);

    try {
      const results = await Promise.all(
        Object.entries(byPo).map(([poIdFilter, lines]) => {
          return apiMutate<any>(`/api/purchase-orders/${poIdFilter}/receptions`, 'POST', {
              purchaseOrderId: poIdFilter,
              locationId,
              notes: notes || undefined,
              packingSlipNumber: packingSlipNumber || undefined,
              lines: lines.map(l => ({
                purchaseOrderLineId: l.purchaseOrderLineId,
                quantityReceived: String(l.quantityReceived),
                ...(l.invoicePricePerUnit !== undefined && { invoicePricePerUnit: String(l.invoicePricePerUnit) })
              }))
          });
        })
      );
      
      const distinctDests = Array.from(new Set(results.map((r: any) => 
        // Need to check if there is a valid destination returned
        r.destination ? `Inventory moved to: ${r.destination.locationName} ${r.destination.zoneName} ${r.destination.binName}` : null
      ).filter(Boolean)));
      
      setFinalDestinations(distinctDests);
      
      toast.success(t('toast.confirmed'));
      setCompleted(true);
      setSaving(false);
      
    } catch (err: any) {
      toast.error(err.message || t('toast.failed'));
      setSaving(false);
    }
  };

  const renderSummaryList = (isReadonly: boolean) => {
    if (draftLines.length === 0) return <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>{t('summary.noItems')}</p>;

    return (
      <div className="overflow-x-auto w-full">
        <table className="table-lines">
          <thead>
            <tr>
              <th>{tCommon('columns.product')}</th>
              <th>{tCommon('columns.description')}</th>
              <th style={{ width: 100, textAlign: 'right' }}>{tCommon('columns.received')}</th>
              <th style={{ width: 140, textAlign: 'right' }}>{tCommon('columns.invoicePrice')}</th>
              <th style={{ width: 180 }}>{tCommon('columns.purchaseOrder')}</th>
              {!isReadonly && <th style={{ width: 80 }}></th>}
            </tr>
          </thead>
          <tbody>
            {draftLines.map(line => {
               const remaining = line.quantityOrdered - line.quantityPreviouslyReceived;
               const isOverReceive = line.quantityReceived > remaining;
               const priceDiscrepancy = line.invoicePricePerUnit !== undefined && line.invoicePricePerUnit !== line.expectedPrice;
               
               return (
                <tr key={line.id} style={{ backgroundColor: line.isQuarantine ? 'rgba(239, 68, 68, 0.05)' : 'transparent' }}>
                  <td style={{ fontWeight: 600, fontSize: 12, color: line.isQuarantine ? 'var(--danger)' : 'inherit' }}>
                     {line.productNumber || line.productId?.substring(0, 8) || '—'}
                  </td>
                  <td>
                     <span style={{ color: line.isQuarantine ? 'var(--danger)' : 'var(--text)', display: 'block', fontSize: 13 }}>
                       {line.productDescription || '—'}
                     </span>
                  </td>
                  
                  <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                     <div style={{ marginBottom: isOverReceive ? 4 : 0 }}>
                        <span style={{ color: line.isQuarantine ? 'var(--danger)' : 'var(--text)', fontSize: 13 }}>{line.quantityReceived}</span>
                     </div>
                     {!line.isQuarantine && isOverReceive && (
                        <span style={{ fontSize: 11, color: 'var(--warning)', display: 'block' }}>
                           {t('summary.overReceive', { qty: remaining })}
                        </span>
                     )}
                  </td>

                  <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                    {!line.isQuarantine && (
                      <div style={{ marginBottom: priceDiscrepancy ? 4 : 0 }}>
                         <span style={{ color: 'var(--text)', fontSize: 13 }}>
                            {line.invoicePricePerUnit !== undefined ? (
                               line.currencyCode ? formatAmount(line.invoicePricePerUnit, line.currencyCode) : Number(line.invoicePricePerUnit).toFixed(2)
                            ) : (
                               <span style={{ color: 'var(--text-muted)' }}>—</span>
                            )}
                         </span>
                      </div>
                    )}
                    
                    {!line.isQuarantine && priceDiscrepancy && (
                       <span style={{ fontSize: 11, color: 'var(--warning)', display: 'block' }}>
                          {t('summary.discrepancy', { price: line.currencyCode ? formatAmount(line.expectedPrice, line.currencyCode) : line.expectedPrice })}
                       </span>
                    )}
                    {line.isQuarantine && (
                       <span style={{ fontSize: 11, color: 'var(--danger)', display: 'block', fontWeight: 500 }}>
                          {t('summary.quarantineMove')}
                       </span>
                    )}
                  </td>

                  <td>
                    {line.isQuarantine ? (
                         <span style={{ fontWeight: 600, color: 'var(--danger)', fontSize: 13 }}>{t('summary.quarantineExceptionHeader')}</span>
                    ) : (
                        isReadonly ? (
                          <Link href={`/purchase-orders/${line.purchaseOrderId}`} style={{ textDecoration: 'none', color: 'var(--accent)', fontWeight: 600, fontSize: 13 }}>
                            {line.orderNumber}
                          </Link>
                        ) : (
                          <span style={{ fontWeight: 500, fontSize: 13 }}>{line.orderNumber}</span>
                        )
                    )}
                  </td>

                  {!isReadonly && (
                    <td style={{ textAlign: 'right' }}>
                       <button className="btn btn-secondary btn-sm" style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }} onClick={() => removeDraftLine(line.id)}>{tCommon('buttons.remove')}</button>
                    </td>
                  )}
                </tr>
               )
            })}
          </tbody>
        </table>
      </div>
    );
  };

  if (completed) {
      return (
        <DetailsLayout
          header={
            <EntityHeader
              title={t('completed.title')}
              subtitle={t('completed.subtitle')}
              actions={
                <div className="flex gap-2">
                  <button className="btn btn-secondary" onClick={() => router.push('/receiving')}>
                    {t('completed.backToReceptions')}
                  </button>
                  <button className="btn btn-primary" onClick={() => { setCompleted(false); setDraftLines([]); setPendingLines([]); setSelectedProduct(null); }}>
                    {t('completed.newReception')}
                  </button>
                </div>
              }
            />
          }
        >
          <div className="flex flex-col gap-6">
            <div className="card flex flex-col gap-4">


              {finalDestinations.length > 0 && (
                <div className="mb-6">
                   <ul style={{ listStyleType: 'none', padding: 0, margin: 0 }}>
                     {finalDestinations.map((dest, i) => (
                       <li key={i} style={{ fontSize: 14, color: 'var(--text-muted)' }}>{dest}</li>
                     ))}
                   </ul>
                </div>
              )}

              {(notes || packingSlipNumber) && (
                <div className="mb-6 flex gap-8 text-sm">
                  {packingSlipNumber && (
                    <div>
                      <strong style={{ color: 'var(--text-muted)', display: 'block', marginBottom: 2 }}>{tCommon('columns.packingSlip')}:</strong>
                      {packingSlipNumber}
                    </div>
                  )}
                  {notes && (
                    <div>
                      <strong style={{ color: 'var(--text-muted)', display: 'block', marginBottom: 2 }}>{tCommon('columns.notes')}:</strong>
                      {notes}
                    </div>
                  )}
                </div>
              )}

              {renderSummaryList(true)}
            </div>
          </div>
        </DetailsLayout>
      );
  }

  return (
    <DetailsLayout
      header={
        <EntityHeader
          title={t('flow.title')}
          subtitle={t('flow.subtitle')}
          isSaving={saving}
          actions={
            <button className="btn btn-primary" onClick={commitReceptions} disabled={draftLines.length === 0 || saving}>
              {t('flow.confirmReception')}
            </button>
          }
        />
      }
    >
      <div className="flex flex-col gap-6">
        {/* Top Side: Scan & Entry */}
        <div className="card flex flex-col gap-4" style={{ height: 'fit-content' }}>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <LocationSelect 
                 value={locationId}
                 onChange={setLocationId}
                 placeholder={t('flow.selectLocation')}
              />
            </div>
            <div>
              <input 
                className="input" 
                placeholder={t('flow.packingSlipPlaceholder')} 
                value={packingSlipNumber} 
                onChange={(e) => setPackingSlipNumber(e.target.value)} 
              />
            </div>
            <div>
              <input 
                className="input" 
                placeholder={t('flow.notesPlaceholder')} 
                value={notes} 
                onChange={(e) => setNotes(e.target.value)} 
              />
            </div>
          </div>

          <h3 className="section-heading mb-0 mt-2">{t('flow.scanProduct')}</h3>
          <ProductSearchInput onSelect={handleProductSelect} placeholder={t('flow.searchPlaceholder')} />
          
          {loadingLines && <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>{t('flow.loadingPending')}</p>}

          {pendingLines.length === 0 && selectedProduct && !loadingLines && !quarantineMode && (
            <div className="flex flex-col gap-4 mt-2 p-4 border rounded" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
              <div>
                <h4 style={{ fontWeight: 600, fontSize: 15 }}>{selectedProduct.name || 'Unknown Product'}</h4>
                <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>{selectedProduct.productNumber || 'No part number'}</p>
              </div>
              <div className="p-3 rounded text-sm" style={{ background: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)' }}>
                {t('flow.noOrdersFound')}
              </div>
              <div className="flex justify-end gap-2">
                <button className="btn btn-secondary" onClick={() => setSelectedProduct(null)}>
                  {t('flow.clear')}
                </button>
                <button className="btn btn-secondary" onClick={() => setQuarantineMode(true)}>
                  {t('flow.markQuarantine')}
                </button>
              </div>
            </div>
          )}

          {pendingLines.length > 0 && !selectedLine && !quarantineMode && (
             <div className="flex flex-col gap-3">
               <h4 style={{ fontSize: 14, fontWeight: 600 }}>{(t as any)('flow.selectOrderLine')}</h4>
               {pendingLines.map(line => {
                  const rem = Number(line.quantity) - Number(line.quantityReceived);
                  return (
                      <div key={line.purchaseOrderLineId} className="border rounded-lg p-4 transition-all" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
                        <div className="flex justify-between items-start mb-2">
                           <div>
                              <a href={`/purchase-orders/${line.purchaseOrderId}`} target="_blank" rel="noopener noreferrer" className="text-sm font-bold text-[#006b5c] hover:underline flex items-center gap-1">
                                 {line.orderNumber}
                                 <span style={{ fontSize: 13 }}>↗</span>
                              </a>
                              <div className="text-xs font-medium text-[rgba(4,22,39,0.7)] mt-0.5">{line.purchaseOrderName || (t as any)('flow.untitledPO')}</div>
                           </div>
                           <button onClick={() => selectLine(line)} className="btn btn-primary btn-sm px-4">
                              {tCommon('select')}
                           </button>
                        </div>
                        <div className="text-xs text-[rgba(4,22,39,0.5)] flex flex-col gap-1">
                           <div className="flex items-center gap-1.5">
                              <span className="font-semibold uppercase tracking-wider text-[10px]">{tCommon('columns.vendor')}:</span>
                              <span className="text-[rgba(4,22,39,0.8)]">{line.vendorName || tCommon('selectNone')}</span>
                           </div>
                           <div>{t('flow.remainingInfo', { desc: line.productDescription, qty: rem.toFixed(2) })}</div>
                        </div>
                      </div>
                  );
               })}
               <button onClick={() => setQuarantineMode(true)} className="btn btn-secondary mt-2" style={{ textAlign: 'left', display: 'block', padding: '10px 14px', borderStyle: 'dashed', borderColor: 'var(--border)' }}>
                  <div style={{ fontWeight: 600, color: 'var(--text)' }}>{t('flow.quarantineException')}</div>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{t('flow.quarantineDesc')}</div>
               </button>
             </div>
          )}

          {selectedLine && !quarantineMode && (
            <div className="flex items-center gap-6 mt-4 p-4 border rounded" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
              <div className="flex-1">
                <h4 style={{ fontWeight: 600, fontSize: 15 }}>{selectedLine.orderNumber}</h4>
                <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>{selectedLine.productDescription}</p>
                <div style={{ fontSize: 12, marginTop: 4, display: 'flex', gap: 12 }}>
                    <span>{t('flow.orderedInfo', { qty: selectedLine.quantity })}</span>
                    <span>{t('flow.receivedInfo', { qty: selectedLine.quantityReceived })}</span>
                    <span>{t('flow.poPriceInfo', { price: selectedLine.currencyCode ? formatAmount(Number(selectedLine.pricePerUnit), selectedLine.currencyCode) : selectedLine.pricePerUnit })}</span>
                </div>
              </div>
              
              <div style={{ width: 140 }}>
                <label className="block mb-1 text-xs font-medium" style={{ color: 'var(--text-muted)' }}>{t('flow.qtyReceived')}</label>
                <input 
                  type="number" 
                  min="0"
                  step="any"
                  className="input w-full" 
                  value={qtyToReceive} 
                  onChange={e => setQtyToReceive(e.target.value)} 
                />
              </div>

              <div style={{ width: 220 }}>
                <label className="block mb-1 text-xs font-medium flex items-center" style={{ color: 'var(--text-muted)' }}>
                  {t('flow.invoicePrice')}
                  {selectedLine.currencyCode && (
                    <span
                      style={{
                        marginLeft: 8,
                        padding: '1px 6px',
                        borderRadius: 4,
                        background: 'rgba(59,130,246,0.15)',
                        color: 'var(--accent)',
                        fontWeight: 600,
                        fontSize: 10,
                        letterSpacing: '0.04em',
                      }}
                    >
                      {selectedLine.currencyCode}
                    </span>
                  )}
                </label>
                <input 
                  type="number" 
                  step="any"
                  className="input w-full" 
                  value={invoicePrice} 
                  onChange={e => setInvoicePrice(e.target.value)} 
                />
              </div>

              <div className="flex gap-2 self-end pb-1">
                <button className="btn btn-secondary" onClick={() => { setSelectedLine(null); setPendingLines([]); setSelectedProduct(null); }}>{t('flow.cancel')}</button>
                <button className="btn btn-primary" onClick={addToDraft}>{t('flow.confirm')}</button>
              </div>
            </div>
          )}

          {quarantineMode && selectedProduct && (
            <div className="flex items-center gap-6 mt-4 p-4 border rounded" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
              <div className="flex-1">
                <h4 style={{ fontWeight: 600, fontSize: 15 }}>{t('summary.quarantineException')}</h4>
                <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>{selectedProduct.name} ({selectedProduct.productNumber})</p>
              </div>
              
              <div style={{ width: 140 }}>
                <label className="block mb-1 text-xs font-medium" style={{ color: 'var(--text-muted)' }}>{t('flow.qtyReceived')}</label>
                <input 
                  type="number" 
                  min="0"
                  step="any"
                  className="input w-full" 
                  value={qtyToReceive} 
                  onChange={e => setQtyToReceive(e.target.value)} 
                />
              </div>

              <div style={{ width: 220 }} />

              <div className="flex gap-2 self-end pb-1">
                <button className="btn btn-secondary" onClick={() => { setQuarantineMode(false); setSelectedLine(null); setSelectedProduct(null); }}>{t('flow.cancel')}</button>
                <button className="btn btn-primary" onClick={addQuarantineToDraft}>{t('flow.confirm')}</button>
              </div>
            </div>
          )}
        </div>

        {/* Bottom Side: Draft Cart & Review */}
        <div className="card flex flex-col gap-4" style={{ height: 'fit-content' }}>
          <h3 className="section-heading">{t('flow.receptionSummary')}</h3>
          {renderSummaryList(false)}
        </div>
      </div>
      
      <style jsx>{`
        .table-lines {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 0;
        }
        .table-lines th {
            text-align: left;
            padding: 10px 12px;
            font-size: 11px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            color: var(--text-muted);
            border-bottom: 2px solid var(--border);
        }
        .table-lines td {
            padding: 12px;
            font-size: 13px;
            border-bottom: 1px solid var(--border);
            vertical-align: middle;
        }
      `}</style>
    </DetailsLayout>
  );
}

export default function ReceivingPage() {
  const tCommon = useTranslations('common');
  return (
    <Suspense fallback={<p style={{ padding: 20 }}>{tCommon('loadingEllipsis')}</p>}>
      <ReceivingFlow />
    </Suspense>
  );
}

'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import * as api from '@modbm/sdk';
import { formatAmount } from '@/lib/currency';
import ProductSearchInput from '@/components/shared/ProductSearchInput';
import type { Product } from '@/components/shared/ProductSearchInput';
import EntityHeader from '@/components/shared/EntityHeader';
import DetailsLayout from '@/components/shared/DetailsLayout';
import { getErrorMessage } from '@modbm/shared';

interface ReturnableLine {
  purchaseOrderId: string;
  orderNumber: string;
  purchaseOrderName?: string;
  vendorName?: string;
  purchaseOrderLineId: string;
  lineNumber: number;
  productDescription: string;
  quantity: string;
  pricePerUnit: string;
  quantityReturned: string;
  currencyCode?: string;
}

interface DraftLine {
  id: string; // unique frontend ID
  purchaseOrderId: string;
  orderNumber: string;
  purchaseOrderLineId: string;
  productDescription: string;
  productId: string;
  quantityOrdered: number;
  quantityPreviouslyReceived: number;
  expectedPrice: number;
  quantityReturned: number;
  returnFeePerUnit?: number;
  isQuarantine?: boolean;
  currencyCode?: string;
}

function ReturnsFlow() {
  const t = useTranslations('purchaseOrders.returns');
  const tCommon = useTranslations('common');
  useDocumentTitle(t('title'));
  const router = useRouter();
  const searchParams = useSearchParams();
  const poId = searchParams.get('poId');

  const [draftLines, setDraftLines] = useState<DraftLine[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [returnableLines, setReturnableLines] = useState<ReturnableLine[]>([]);
  const [loadingLines, setLoadingLines] = useState(false);
  
  // Entry step state
  const [selectedLine, setSelectedLine] = useState<ReturnableLine | null>(null);
  const [qtyToReceive, setQtyToReceive] = useState<string>('');
  const [returnFee, setInvoicePrice] = useState<string>('');
  
  const [saving, setSaving] = useState(false);
  const [quarantineMode, setQuarantineMode] = useState(false);
  const [error, setError] = useState('');

  const handleProductSelect = async (product: Product) => {
    setSelectedProduct(product);
    setLoadingLines(true);
    setSelectedLine(null);
    setQuarantineMode(false);
    setReturnableLines([]);
    setQtyToReceive('');
    setInvoicePrice('');
    
    try {
      const res = await api.purchaseOrdersControllerFindReturnableLines({ productId: product.productId });
      
      // Filter out lines that are already in the draft fully
      // But for simplicity, we just fetch state from server.
      const data = res.data || [];
      setReturnableLines(data as unknown as ReturnableLine[]);
      
      if (data.length > 0) {
        selectLine(data[0] as unknown as ReturnableLine);
      } else if (poId) {
        const matches = (data as any[]).filter((x) => x.purchaseOrderId === poId);
        if (matches.length > 0) {
             selectLine(matches[0] as unknown as ReturnableLine);
         }
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? getErrorMessage(err) : 'Unknown error');
    } finally {
      setLoadingLines(false);
    }
  };

  const selectLine = (line: ReturnableLine) => {
    setSelectedLine(line);
    const prevReceived = Number(line.quantityReturned) || 0;
    
    // Check if we already have some in draft for this line
    const draftedQty = draftLines
        .filter(dl => dl.purchaseOrderLineId === line.purchaseOrderLineId)
        .reduce((sum, dl) => sum + dl.quantityReturned, 0);

    const remaining = Number(line.quantity) - prevReceived - draftedQty;
    
    setQtyToReceive(remaining > 0 ? remaining.toString() : '0');
    // Standardize to 2 decimals
    setInvoicePrice(parseFloat(line.pricePerUnit).toFixed(2));
  };

  const addToDraft = () => {
    if (!selectedLine || !selectedProduct) return;
    const qty = Number(qtyToReceive);
    if (qty <= 0) {
      setError('Quantity must be greater than 0');
      return;
    }
    
    setDraftLines([...draftLines, {
      id: Math.random().toString(36).substring(7),
      purchaseOrderId: selectedLine.purchaseOrderId,
      orderNumber: selectedLine.orderNumber,
      purchaseOrderLineId: selectedLine.purchaseOrderLineId,
      productDescription: selectedLine.productDescription,
      productId: selectedProduct.productId,
      quantityOrdered: Number(selectedLine.quantity),
      quantityPreviouslyReceived: Number(selectedLine.quantityReturned),
      expectedPrice: Number(selectedLine.pricePerUnit),
      quantityReturned: qty,
      returnFeePerUnit: returnFee ? Number(returnFee) : undefined,
      currencyCode: selectedLine.currencyCode
    }]);

    setSelectedProduct(null);
    setSelectedLine(null);
    setReturnableLines([]);
    setQtyToReceive('');
    setInvoicePrice('');
    setError('');
  };

  const addQuarantineToDraft = () => {
    if (!selectedProduct) return;
    const qty = Number(qtyToReceive);
    if (qty <= 0) {
      setError('Quantity must be greater than 0');
      return;
    }
    
    setDraftLines([...draftLines, {
      id: Math.random().toString(36).substring(7),
      purchaseOrderId: 'QUARANTINE',
      orderNumber: 'Q-EXCEPTION',
      purchaseOrderLineId: 'QUARANTINE',
      productDescription: selectedProduct.name,
      productId: selectedProduct.productId,
      quantityOrdered: 0,
      quantityPreviouslyReceived: 0,
      expectedPrice: 0,
      quantityReturned: qty,
      isQuarantine: true
    }]);

    setSelectedProduct(null);
    setQuarantineMode(false);
    setQtyToReceive('');
    setError('');
  };

  const removeDraftLine = (id: string) => {
    setDraftLines(draftLines.filter(l => l.id !== id));
  };

  const commitReturns = async () => {
    if (draftLines.length === 0) return;
    setSaving(true);
    setError('');

    const validLines = draftLines.filter(l => !l.isQuarantine);

    const byPo = validLines.reduce((acc, curr) => {
      if (!acc[curr.purchaseOrderId]) acc[curr.purchaseOrderId] = [];
      acc[curr.purchaseOrderId].push(curr);
      return acc;
    }, {} as Record<string, DraftLine[]>);

    try {
      await Promise.all(
        Object.entries(byPo).map(([poIdFilter, lines]) => {
              return api.purchaseReturnsControllerCreateReturn(poIdFilter, {
                 notes: 'Returned via UI',
                 lines: lines.map(l => ({
                    purchaseOrderLineId: l.purchaseOrderLineId,
                    quantityReturned: String(l.quantityReturned),
                    returnFee: String(l.returnFeePerUnit || 0)
                 }))
              });
        })
      );
      
      router.push('/purchase-orders');
      
    } catch (err: unknown) {
      setError(getErrorMessage(err) || 'Failed to commit returns');
      setSaving(false);
    }
  };

  return (
    <DetailsLayout
      header={
        <EntityHeader
          title={t('title')}
          subtitle={t('subtitle')}
          onBack={() => router.back()}
          isSaving={saving}
          actions={
            <button className="btn btn-primary" onClick={commitReturns} disabled={draftLines.length === 0 || saving}>
              {t('confirmReturns')}
            </button>
          }
          showPrint={false}
        />
      }
    >
      <div className="flex flex-col gap-6">
        {/* Top Side: Scan & Entry */}
        <div className="card flex flex-col gap-4" style={{ height: 'fit-content' }}>
          <h3 className="section-heading">{t('scanProduct')}</h3>
          
          <ProductSearchInput onSelect={handleProductSelect} placeholder={t('placeholder')} />
          
          {loadingLines && <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>{t('loadingLines')}</p>}
          
          {error && <p style={{ color: 'var(--danger)', fontSize: 13 }}>{error}</p>}

          {returnableLines.length === 0 && selectedProduct && !loadingLines && !error && !quarantineMode && (
            <div className="flex flex-col gap-4 mt-2 p-4 border rounded" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
              <div>
                <h4 style={{ fontWeight: 600, fontSize: 15 }}>{selectedProduct.name || t('unknownProduct')}</h4>
                <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>{selectedProduct.productNumber || t('noPartNumber')}</p>
              </div>
              <div className="p-3 rounded text-sm" style={{ background: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)' }}>
                {t('noActivePOs')}
              </div>
              <div className="flex gap-2">
                <button className="btn btn-secondary flex-1" onClick={() => setSelectedProduct(null)}>
                  {t('clear')}
                </button>
                <button className="btn btn-secondary flex-1" onClick={() => setQuarantineMode(true)}>
                  {t('markQuarantine')}
                </button>
              </div>
            </div>
          )}

          {returnableLines.length > 0 && !selectedLine && !quarantineMode && (
             <div className="flex flex-col gap-3">
               <h4 style={{ fontSize: 14, fontWeight: 600 }}>{t('selectPOLine')}</h4>
               {returnableLines.map(line => {
                  const rem = Number(line.quantity) - Number(line.quantityReturned);
                  return (
                      <div key={line.purchaseOrderLineId} className="border rounded-lg p-4 transition-all" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
                        <div className="flex justify-between items-start mb-2">
                           <div>
                              <a href={`/purchase-orders/${line.purchaseOrderId}`} target="_blank" rel="noopener noreferrer" className="text-sm font-bold text-[#006b5c] hover:underline flex items-center gap-1">
                                 {line.orderNumber}
                                 <span style={{ fontSize: 13 }}>↗</span>
                              </a>
                              <div className="text-xs font-medium text-[rgba(4,22,39,0.7)] mt-0.5">{line.purchaseOrderName || tCommon('orderReadView.untitledOrder')}</div>
                           </div>
                           <button onClick={() => selectLine(line)} className="btn btn-primary btn-sm px-4">
                              {tCommon('select')}
                           </button>
                        </div>
                        <div className="text-xs text-[rgba(4,22,39,0.5)] flex flex-col gap-1">
                           <div className="flex items-center gap-1.5">
                              <span className="font-semibold uppercase tracking-wider text-[10px]">{tCommon('columns.vendor')}:</span>
                              <span className="text-[rgba(4,22,39,0.8)]">{line.vendorName || tCommon('none')}</span>
                           </div>
                           <div>{line.productDescription} ({t('remaining', { rem: rem.toFixed(2) })})</div>
                        </div>
                      </div>
                  );
               })}
               <button onClick={() => setQuarantineMode(true)} className="btn btn-secondary mt-2" style={{ textAlign: 'left', display: 'block', padding: '10px 14px', borderStyle: 'dashed', borderColor: 'var(--border)' }}>
                  <div style={{ fontWeight: 600, color: 'var(--text)' }}>{t('quarantineBtnTitle')}</div>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{t('quarantineBtnSub')}</div>
               </button>
             </div>
          )}

          {selectedLine && !quarantineMode && (
            <div className="flex items-center gap-6 mt-4 p-4 border rounded" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
              <div className="flex-1">
                <h4 style={{ fontWeight: 600, fontSize: 15 }}>{selectedLine.orderNumber}</h4>
                <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>{selectedLine.productDescription}</p>
                <div style={{ fontSize: 12, marginTop: 4, display: 'flex', gap: 12 }}>
                    <span>{t('ordered')} <strong>{selectedLine.quantity}</strong></span>
                    <span>{t('received')} <strong>{selectedLine.quantityReturned}</strong></span>
                    <span>{t('poPrice')} <strong>{selectedLine.currencyCode ? formatAmount(Number(selectedLine.pricePerUnit), selectedLine.currencyCode) : selectedLine.pricePerUnit}</strong></span>
                </div>
              </div>
              
              <div style={{ width: 140 }}>
                <label className="block mb-1 text-xs font-medium" style={{ color: 'var(--text-muted)' }}>{t('qtyReturned')}</label>
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
                  {t('returnFee')}
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
                  value={returnFee} 
                  onChange={e => setInvoicePrice(e.target.value)} 
                />
              </div>

              <div className="flex gap-2 self-end pb-1">
                <button className="btn btn-secondary" onClick={() => { setSelectedLine(null); setReturnableLines([]); setSelectedProduct(null); }}>{t('cancel')}</button>
                <button className="btn btn-primary" onClick={addToDraft}>{t('confirm')}</button>
              </div>
            </div>
          )}

          {quarantineMode && selectedProduct && (
            <div className="flex items-center gap-6 mt-4 p-4 border rounded" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
              <div className="flex-1">
                <h4 style={{ fontWeight: 600, fontSize: 15 }}>{t('exceptionQuarantine')}</h4>
                <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>{selectedProduct.name} ({selectedProduct.productNumber})</p>
              </div>
              
              <div style={{ width: 140 }}>
                <label className="block mb-1 text-xs font-medium" style={{ color: 'var(--text-muted)' }}>{t('qtyToQuarantine')}</label>
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
                <button className="btn btn-secondary" onClick={() => { setQuarantineMode(false); setSelectedLine(null); setSelectedProduct(null); }}>{t('cancel')}</button>
                <button className="btn" style={{ background: 'var(--text)', color: 'var(--bg)' }} onClick={addQuarantineToDraft}>{t('confirm')}</button>
              </div>
            </div>
          )}
        </div>

        {/* Bottom Side: Draft Cart & Review */}
        <div className="card flex flex-col gap-4" style={{ height: 'fit-content' }}>
          <h3 className="section-heading">{t('returnsSummary')}</h3>
          {draftLines.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>{t('noItemsScanned')}</p>
          ) : (
            <div className="flex flex-col gap-3">
              {draftLines.map(line => {
                 const remaining = line.quantityOrdered - line.quantityPreviouslyReceived;
                 const isOverReceive = line.quantityReturned > remaining;
                 const returnFeeDiscrepancy = line.returnFeePerUnit !== undefined && line.returnFeePerUnit !== line.expectedPrice;
                 
                 return (
                   <div key={line.id} className="flex items-center gap-6 p-4 border rounded" style={{ borderColor: line.isQuarantine ? 'var(--danger)' : 'var(--border)', backgroundColor: line.isQuarantine ? 'rgba(239, 68, 68, 0.05)' : 'transparent' }}>
                    <div className="flex-1">
                       <h4 style={{ fontWeight: 600, fontSize: 15, color: line.isQuarantine ? 'var(--danger)' : undefined }}>
                         {line.isQuarantine ? t('exceptionQuarantineTag') : line.orderNumber}
                       </h4>
                       <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>{line.productDescription}</p>
                    </div>
                    
                    <div style={{ width: 140 }}>
                       <span style={{ fontSize: 13, color: 'var(--text-muted)', display: 'block', marginBottom: 2 }}>{t('qtyReturnedSummary')}</span>
                       <span style={{ fontWeight: 600, fontSize: 15, color: line.isQuarantine ? 'var(--danger)' : 'var(--text)' }}>{line.quantityReturned}</span>
                    </div>

                    <div style={{ width: 220 }}>
                       <div style={{ marginBottom: returnFeeDiscrepancy ? 4 : 0 }}>
                          <span style={{ color: 'var(--text)', fontSize: 13 }}>
                             {line.returnFeePerUnit !== undefined ? (
                                line.currencyCode ? formatAmount(line.returnFeePerUnit, line.currencyCode) : Number(line.returnFeePerUnit).toFixed(2)
                             ) : (
                                <span style={{ color: 'var(--text-muted)' }}>—</span>
                             )}
                          </span>
                       </div>
                      {!line.isQuarantine && returnFeeDiscrepancy && (
                         <span style={{ fontSize: 12, color: 'var(--warning)', display: 'block' }}>
                            {t('returnFeeDiscrepancy', { amount: line.currencyCode ? formatAmount(line.returnFeePerUnit || 0, line.currencyCode) : line.returnFeePerUnit || 0, expected: line.currencyCode ? formatAmount(line.expectedPrice, line.currencyCode) : line.expectedPrice })}
                         </span>
                      )}
                      {!line.isQuarantine && isOverReceive && (
                         <span style={{ fontSize: 12, color: 'var(--warning)', marginTop: returnFeeDiscrepancy ? 4 : 0, display: 'block' }}>
                            {t('exceptionQuarantine', { expected: remaining, receiving: line.quantityReturned })}
                         </span>
                      )}
                      {line.isQuarantine && (
                         <span style={{ fontSize: 12, color: 'var(--danger)', display: 'block', fontWeight: 500 }}>
                            <span dangerouslySetInnerHTML={{ __html: t('moveToQuarantine') }} />
                         </span>
                      )}
                    </div>

                    <div className="flex gap-2">
                       <button className="btn btn-secondary" style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }} onClick={() => removeDraftLine(line.id)}>{t('remove')}</button>
                    </div>
                   </div>
                 )
              })}
            </div>
          )}
        </div>
      </div>
    </DetailsLayout>
  );
}

export default function ReturnsPage() {
  return (
    <Suspense fallback={<p style={{ padding: 20 }}>Loading...</p>}>
      <ReturnsFlow />
    </Suspense>
  );
}

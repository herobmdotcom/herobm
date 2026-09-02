'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import * as api from '@herobm/sdk';
import { formatAmount } from '@/lib/currency';
import ProductSearchInput from '@/components/shared/ProductSearchInput';
import type { Product } from '@/components/shared/ProductSearchInput';
import EntityHeader from '@/components/shared/EntityHeader';
import DetailsLayout from '@/components/shared/DetailsLayout';
import { getErrorMessage } from '@herobm/shared';
import { Button } from '@/components/shared/Button';
import { routes } from '@/lib/routes';

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

function CreatePurchaseReturnFlow() {
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
      const data = res.data || [];
      setReturnableLines(data as unknown as ReturnableLine[]);
      
      if (data.length > 0) {
        selectLine(data[0] as unknown as ReturnableLine);
      } else if (poId) {
        const matches = (data as unknown as ReturnableLine[]).filter((x) => x.purchaseOrderId === poId);
        if (matches.length > 0) {
          selectLine(matches[0]);
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
      .filter((dl) => dl.purchaseOrderLineId === line.purchaseOrderLineId)
      .reduce((sum, dl) => sum + dl.quantityReturned, 0);

    const remaining = Number(line.quantity) - prevReceived - draftedQty;
    
    setQtyToReceive(remaining > 0 ? remaining.toString() : '0');
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
      currencyCode: selectedLine.currencyCode,
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
      isQuarantine: true,
    }]);

    setSelectedProduct(null);
    setQuarantineMode(false);
    setQtyToReceive('');
    setError('');
  };

  const removeDraftLine = (id: string) => {
    setDraftLines(draftLines.filter((l) => l.id !== id));
  };

  const commitReturns = async () => {
    if (draftLines.length === 0) return;
    setSaving(true);
    setError('');

    const validLines = draftLines.filter((l) => !l.isQuarantine);

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
            lines: lines.map((l) => ({
              purchaseOrderLineId: l.purchaseOrderLineId,
              quantityReturned: String(l.quantityReturned),
              returnFee: String(l.returnFeePerUnit || 0),
            })),
          });
        }),
      );
      
      router.push(routes.purchaseOrders.returns.list());
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
          isSaving={saving}
          actions={
            <Button variant="primary" onClick={commitReturns} disabled={draftLines.length === 0 || saving}>
              {t('confirmReturns')}
            </Button>
          }
          showPrint={false}
        />
      }
    >
      <div className="flex flex-col gap-6">
        {/* Top Side: Scan & Entry */}
        <div className="card flex flex-col gap-4 h-fit">
          <h3 className="section-heading">{t('scanProduct')}</h3>
          
          <ProductSearchInput onSelect={handleProductSelect} placeholder={t('placeholder')} />
          
          {loadingLines && <p className="text-[var(--text-muted)] text-[13px]">{t('loadingLines')}</p>}
          
          {error && <p className="text-[var(--danger)] text-[13px]">{error}</p>}

          {returnableLines.length === 0 && selectedProduct && !loadingLines && !error && !quarantineMode && (
            <div className="flex flex-col gap-4 mt-2 p-4 border rounded border-[var(--border)] bg-[var(--surface)]">
              <div>
                <h4 className="font-semibold text-[15px]">{selectedProduct.name || t('unknownProduct')}</h4>
                <p className="text-[13px] text-[var(--text-muted)]">{selectedProduct.productNumber || t('noPartNumber')}</p>
              </div>
              <div className="p-3 rounded text-sm bg-red-500/10 text-[var(--danger)]">
                {t('noActivePOs')}
              </div>
              <div className="flex gap-2">
                <Button variant="secondary" className="flex-1" onClick={() => setSelectedProduct(null)}>
                  {t('clear')}
                </Button>
                <Button variant="secondary" className="flex-1" onClick={() => setQuarantineMode(true)}>
                  {t('markQuarantine')}
                </Button>
              </div>
            </div>
          )}

          {returnableLines.length > 0 && !selectedLine && !quarantineMode && (
            <div className="flex flex-col gap-3">
              <h4 className="text-sm font-semibold">{t('selectPOLine')}</h4>
              {returnableLines.map((line) => {
                const rem = Number(line.quantity) - Number(line.quantityReturned);
                return (
                  <div key={line.purchaseOrderLineId} className="border rounded-lg p-4 transition-all bg-[var(--surface)] border-[var(--border)]">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <a href={`/purchase-orders/${line.purchaseOrderId}`} target="_blank" rel="noopener noreferrer" className="text-sm font-bold text-[#006b5c] hover:underline flex items-center gap-1">
                          {line.orderNumber}
                          <span className="text-[13px]">↗</span>
                        </a>
                        <div className="text-xs font-medium text-[rgba(4,22,39,0.7)] mt-0.5">{line.purchaseOrderName || tCommon('orderReadView.untitledOrder')}</div>
                      </div>
                      <Button onClick={() => selectLine(line)} variant="primary" size="sm" className="px-4">
                        {tCommon('select')}
                      </Button>
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
              <Button onClick={() => setQuarantineMode(true)} variant="secondary" className="mt-2 text-left block px-3.5 py-2.5 border-dashed border-[var(--border)]">
                <div className="font-semibold text-[var(--text)]">{t('quarantineBtnTitle')}</div>
                <div className="text-[13px] text-[var(--text-muted)]">{t('quarantineBtnSub')}</div>
              </Button>
            </div>
          )}

          {selectedLine && !quarantineMode && (
            <div className="flex items-center gap-6 mt-4 p-4 border rounded border-[var(--border)] bg-[var(--surface)]">
              <div className="flex-1">
                <h4 className="font-semibold text-[15px]">{selectedLine.orderNumber}</h4>
                <p className="text-[13px] text-[var(--text-muted)]">{selectedLine.productDescription}</p>
                <div className="text-xs mt-1 flex gap-3">
                  <span>{t('ordered')} <strong>{selectedLine.quantity}</strong></span>
                  <span>{t('received')} <strong>{selectedLine.quantityReturned}</strong></span>
                  <span>{t('poPrice')} <strong>{selectedLine.currencyCode ? formatAmount(Number(selectedLine.pricePerUnit), selectedLine.currencyCode) : selectedLine.pricePerUnit}</strong></span>
                </div>
              </div>
              
              <div className="w-[140px]">
                <label className="block mb-1 text-xs font-medium text-[var(--text-muted)]">{t('qtyReturned')}</label>
                <input 
                  type="number" 
                  min="0" 
                  step="any" 
                  className="input w-full" 
                  value={qtyToReceive} 
                  onChange={(e) => setQtyToReceive(e.target.value)} 
                />
              </div>

              <div className="w-[220px]">
                <label className="block mb-1 text-xs font-medium flex items-center text-[var(--text-muted)]">
                  {t('returnFee')}
                  {selectedLine.currencyCode && (
                    <span className="ml-2 px-1.5 py-0.5 rounded bg-blue-500/15 text-[var(--accent)] font-semibold text-[10px] tracking-wide">
                      {selectedLine.currencyCode}
                    </span>
                  )}
                </label>
                <input 
                  type="number" 
                  step="any" 
                  className="input w-full" 
                  value={returnFee} 
                  onChange={(e) => setInvoicePrice(e.target.value)} 
                />
              </div>

              <div className="flex gap-2 self-end pb-1">
                <Button variant="secondary" onClick={() => { setSelectedLine(null); setReturnableLines([]); setSelectedProduct(null); }}>{t('cancel')}</Button>
                <Button variant="primary" onClick={addToDraft}>{t('confirm')}</Button>
              </div>
            </div>
          )}

          {quarantineMode && selectedProduct && (
            <div className="flex items-center gap-6 mt-4 p-4 border rounded border-[var(--border)] bg-[var(--surface)]">
              <div className="flex-1">
                <h4 className="font-semibold text-[15px]">{t('exceptionQuarantine')}</h4>
                <p className="text-[13px] text-[var(--text-muted)]">{selectedProduct.name} ({selectedProduct.productNumber})</p>
              </div>
              
              <div className="w-[140px]">
                <label className="block mb-1 text-xs font-medium text-[var(--text-muted)]">{t('qtyToQuarantine')}</label>
                <input 
                  type="number" 
                  min="0" 
                  step="any" 
                  className="input w-full" 
                  value={qtyToReceive} 
                  onChange={(e) => setQtyToReceive(e.target.value)} 
                />
              </div>

              <div className="w-[220px]" />

              <div className="flex gap-2 self-end pb-1">
                <Button variant="secondary" onClick={() => { setQuarantineMode(false); setSelectedLine(null); setSelectedProduct(null); }}>{t('cancel')}</Button>
                <Button className="bg-[var(--text)] text-[var(--bg)]" onClick={addQuarantineToDraft}>{t('confirm')}</Button>
              </div>
            </div>
          )}
        </div>

        {/* Bottom Side: Draft Cart & Review */}
        <div className="card flex flex-col gap-4 h-fit">
          <h3 className="section-heading">{t('returnsSummary')}</h3>
          {draftLines.length === 0 ? (
            <p className="text-[var(--text-muted)] text-sm">{t('noItemsScanned')}</p>
          ) : (
            <div className="flex flex-col gap-3">
              {draftLines.map((line) => {
                const remaining = line.quantityOrdered - line.quantityPreviouslyReceived;
                const isOverReceive = line.quantityReturned > remaining;
                const returnFeeDiscrepancy = line.returnFeePerUnit !== undefined && line.returnFeePerUnit !== line.expectedPrice;
                
                return (
                  <div key={line.id} className={`flex items-center gap-6 p-4 border rounded ${line.isQuarantine ? 'border-[var(--danger)] bg-red-500/5' : 'border-[var(--border)] bg-transparent'}`}>
                    <div className="flex-1">
                      <h4 className={`font-semibold text-[15px] ${line.isQuarantine ? 'text-[var(--danger)]' : ''}`}>
                        {line.isQuarantine ? t('exceptionQuarantineTag') : line.orderNumber}
                      </h4>
                      <p className="text-[13px] text-[var(--text-muted)]">{line.productDescription}</p>
                    </div>
                    
                    <div className="w-[140px]">
                      <span className="text-[13px] text-[var(--text-muted)] block mb-0.5">{t('qtyReturnedSummary')}</span>
                      <span className={`font-semibold text-[15px] ${line.isQuarantine ? 'text-[var(--danger)]' : 'text-[var(--text)]'}`}>{line.quantityReturned}</span>
                    </div>

                    <div className="w-[220px]">
                      <div className={returnFeeDiscrepancy ? 'mb-1' : 'mb-0'}>
                        <span className="text-[var(--text)] text-[13px]">
                          {line.returnFeePerUnit !== undefined ? (
                            line.currencyCode ? formatAmount(line.returnFeePerUnit, line.currencyCode) : Number(line.returnFeePerUnit).toFixed(2)
                          ) : (
                            <span className="text-[var(--text-muted)]">—</span>
                          )}
                        </span>
                      </div>
                      {!line.isQuarantine && returnFeeDiscrepancy && (
                        <span className="text-xs text-[var(--warning)] block">
                          {t('returnFeeDiscrepancy', { amount: line.currencyCode ? formatAmount(line.returnFeePerUnit || 0, line.currencyCode) : line.returnFeePerUnit || 0, expected: line.currencyCode ? formatAmount(line.expectedPrice, line.currencyCode) : line.expectedPrice })}
                        </span>
                      )}
                      {!line.isQuarantine && isOverReceive && (
                        <span className={`text-xs text-[var(--warning)] block ${returnFeeDiscrepancy ? 'mt-1' : 'mt-0'}`}>
                          {t('exceptionQuarantine', { expected: remaining, receiving: line.quantityReturned })}
                        </span>
                      )}
                      {line.isQuarantine && (
                        <span className="text-xs text-[var(--danger)] block font-medium">
                          <span dangerouslySetInnerHTML={{ __html: t('moveToQuarantine') }} />
                        </span>
                      )}
                    </div>

                    <div className="flex gap-2">
                      <Button variant="secondary" className="text-[var(--danger)] border-[var(--danger)]" onClick={() => removeDraftLine(line.id)}>{t('remove')}</Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </DetailsLayout>
  );
}

export default function NewPurchaseReturnPage() {
  return (
    <Suspense fallback={<p className="p-5">Loading...</p>}>
      <CreatePurchaseReturnFlow />
    </Suspense>
  );
}

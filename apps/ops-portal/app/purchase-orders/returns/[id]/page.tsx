'use client';

import { use } from 'react';
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import EntityHeader from '@/components/shared/EntityHeader';
import DetailsLayout from '@/components/shared/DetailsLayout';
import * as api from '@modbm/sdk';
import { PURCHASE_RETURN_STATE } from '@modbm/shared';
import { getErrorMessage } from '@modbm/shared';

export default function PurchaseReturnDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const tCommon = useTranslations('common');
  const t = useTranslations('purchaseOrders.returns');
  
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [returnDetails, setReturnDetails] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [supplierReferenceNumber, setSupplierReferenceNumber] = useState('');
  const [taxAmount, setTaxAmount] = useState('0');
  const [feeAmount, setFeeAmount] = useState('0');
  const [notes, setNotes] = useState('');
  const [linePrices, setLinePrices] = useState<{ [key: string]: string }>({});
  
  const [submitting, setSubmitting] = useState(false);

  useDocumentTitle(returnDetails ? `Return ${returnDetails.returnNumber}` : 'Return Details');

  useEffect(() => {
    let active = true;
    api.globalPurchaseReturnsControllerGetPurchaseReturnById(id)
      .then(res => {
        if (active) {
          setReturnDetails(res.data);
          // Default line prices to 0, they should fill this out or we can fetch PO line price.
          // For simplicity, they have to fill it out.
        }
      })
      .catch(err => {
        if (active) setError(getErrorMessage(err));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [id]);

  const handleSubmit = async () => {
    try {
      setSubmitting(true);
      setError(null);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const lines = returnDetails.lines.map((line: any) => ({
        purchaseOrderLineId: line.purchaseOrderLineId,
        quantityInvoiced: line.quantityReturned,
        pricePerUnit: linePrices[line.returnLineId] || '0',
        amount: (parseFloat(line.quantityReturned) * parseFloat(linePrices[line.returnLineId] || '0')).toFixed(2),
      }));

      const payload = {
        returnId: id,
        supplierReferenceNumber,
        lines,
        taxAmount,
        feeAmount,
        notes,
      };

      const res = await api.purchaseDebitNotesControllerCreateDebitNote(payload as unknown as Parameters<typeof api.purchaseDebitNotesControllerCreateDebitNote>[0]);

      // After creation, optionally post it directly:
      await api.purchaseDebitNotesControllerPostDebitNote((res.data as unknown as { debitNoteId?: string, id?: string }).debitNoteId || (res.data as unknown as { debitNoteId?: string, id?: string }).id || '', {});

      router.push(`/purchase-orders/${returnDetails.purchaseOrderId}`);
    } catch (err: unknown) {
      setError(getErrorMessage(err) || 'Failed to create Debit Note');
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="p-6">{tCommon('loading')}</div>;
  }

  if (!returnDetails) {
    return <div className="p-6 text-red-600">{error || t('notFound')}</div>;
  }

  const isShipped = returnDetails.stateCode === PURCHASE_RETURN_STATE.SHIPPED;

  return (
    <DetailsLayout
      header={
        <EntityHeader
          title={returnDetails.returnNumber}
          subtitle={`PO: ${returnDetails.orderNumber} • ${returnDetails.vendorName}`}
          onBack={() => router.back()}
          badges={<span className="badge badge-info">{returnDetails.stateCode.toUpperCase()}</span>}
        />
      }
    >
      <div className="flex flex-col gap-4">
        {error && (
          <div className="px-4 py-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
            {error}
          </div>
        )}

        <div className="card">
          <h3 className="section-heading mb-4">{t('debitNoteEntry')}</h3>
          
          {!isShipped ? (
            <div className="p-4 bg-amber-50 border border-amber-200 text-amber-800 rounded">
              <p className="text-sm">
                {t('debitNoteWarning')}
              </p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="block text-xs font-medium mb-1 text-[var(--text-muted)]">{t('supplierReturnRef')}</label>
                  <input
                    type="text"
                    className="input w-full"
                    value={supplierReferenceNumber}
                    onChange={e => setSupplierReferenceNumber(e.target.value)}
                    placeholder="e.g. DN-2026-001"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1 text-[var(--text-muted)]">{t('totalTaxAmount')}</label>
                  <input
                    type="number"
                    className="input w-full"
                    value={taxAmount}
                    onChange={e => setTaxAmount(e.target.value)}
                    step="0.01"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1 text-[var(--text-muted)]">{t('restockingFee')}</label>
                  <input
                    type="number"
                    className="input w-full"
                    value={feeAmount}
                    onChange={e => setFeeAmount(e.target.value)}
                    step="0.01"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium mb-1 text-[var(--text-muted)]">{t('notes')}</label>
                  <input
                    type="text"
                    className="input w-full"
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                  />
                </div>
              </div>

              <h4 className="text-sm font-semibold mb-2">{t('lineItems')}</h4>
              <table className="table-lines mb-6">
                <thead>
                  <tr>
                    <th>{t('lineHash')}</th>
                    <th className="text-right">{t('qtyReturned')}</th>
                    <th className="text-right">{t('creditPricePerUnit')}</th>
                    <th className="text-right">{t('lineTotal')}</th>
                  </tr>
                </thead>
                <tbody>
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  {returnDetails.lines.map((line: any) => {
                    const price = parseFloat(linePrices[line.returnLineId] || '0');
                    const total = parseFloat(line.quantityReturned) * price;
                    return (
                      <tr key={line.returnLineId}>
                        <td>{line.purchaseOrderLineId.substring(0, 8)}</td>
                        <td className="text-right">{parseFloat(line.quantityReturned)}</td>
                        <td className="text-right">
                          <input
                            type="number"
                            className="input w-32 text-right"
                            step="0.01"
                            value={linePrices[line.returnLineId] || ''}
                            onChange={e => setLinePrices({ ...linePrices, [line.returnLineId]: e.target.value })}
                            placeholder="0.00"
                          />
                        </td>
                        <td className="text-right font-semibold">
                          {total.toFixed(2)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              <div className="flex justify-end mt-4">
                <button
                  className="btn btn-primary"
                  onClick={handleSubmit}
                  disabled={submitting}
                >
                  {submitting ? t('recording') : t('confirmDebitNote')}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </DetailsLayout>
  );
}

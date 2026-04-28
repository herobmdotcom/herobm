'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import EntityHeader from '@/components/shared/EntityHeader';
import DetailsLayout from '@/components/shared/DetailsLayout';
import StateBadge from '@/components/StateBadge';
import { apiFetch, apiMutate, reportError } from '@/lib/api';
import { formatAmount } from '@/lib/currency';
import { ValidState } from '@/types/states';
import POLineSearchInput from '@/components/shared/POLineSearchInput';

interface PurchaseInvoiceDetails {
  invoiceId: string;
  invoiceNumber: string;
  supplierInvoiceNumber: string;
  vendorId: string;
  purchaseOrderId?: string;
  receiptFilename?: string;
  totalAmount: string;
  taxAmount: string;
  currencyCode: string;
  stateCode: string;
  notes?: string;
  createdOn: string;
  lines: {
    lineId: string;
    description: string;
    productId?: string;
    productNumber?: string;
    purchaseOrderId?: string;
    purchaseOrderNumber?: string;
    matchStatus: string;
    quantityInvoiced: string;
    pricePerUnit: string;
    amount: string;
  }[];
}

export default function PurchaseInvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { id } = React.use(params);
  const t = useTranslations('purchaseOrders');
  const tCommon = useTranslations('common');
  const [invoice, setInvoice] = useState<PurchaseInvoiceDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  useDocumentTitle(invoice ? `Invoice ${invoice.invoiceNumber}` : 'Loading Invoice...');

  useEffect(() => {
    apiFetch<PurchaseInvoiceDetails>(`/api/purchase-invoices/${id}`)
      .then(setInvoice)
      .catch(err => reportError(err, 'PurchaseInvoiceDetailPage'))
      .finally(() => setLoading(false));
  }, [id, refreshKey]);

  if (loading) {
    return <div className="flex items-center justify-center p-12 text-gray-500 text-sm">Loading...</div>;
  }

  if (!invoice) {
    return <div className="flex items-center justify-center p-12 text-gray-500 text-sm">Invoice not found.</div>;
  }

  const InvoiceAllocationCell = ({ line }: { line: PurchaseInvoiceDetails['lines'][0] }) => {
    const [isResolving, setIsResolving] = useState(false);
    const [poLineId, setPoLineId] = useState('');

    const handleUnresolve = async () => {
      if (!confirm('Are you sure you want to change this allocation?')) return;
      try {
        await apiMutate(`/api/purchase-invoices/lines/${line.lineId}/unresolve`, 'POST');
        setRefreshKey(k => k + 1);
      } catch (err: any) {
        alert(err.message || 'Failed to unresolve allocation');
      }
    };

    if (line.matchStatus === 'matched') {
      return (
        <div className="flex items-center justify-start gap-2 h-full w-full">
          <span style={{ fontWeight: 500 }}>{line.purchaseOrderNumber}</span>
          <span className="badge badge-success">{line.matchStatus}</span>
          <button
            onClick={handleUnresolve}
            className="btn btn-secondary btn-sm"
            style={{ padding: '0 6px', height: 22, fontSize: 11, marginLeft: 8 }}
            title="Change Allocation"
          >
            {/* eslint-disable-next-line i18next/no-literal-string */}
            Change
          </button>
        </div>
      );
    }

    const handleResolve = async () => {
      if (!poLineId) {
        alert('Please select a PO Line');
        return;
      }
      try {
        await apiMutate(`/api/purchase-invoices/lines/${line.lineId}/resolve`, 'POST', { purchaseOrderLineId: poLineId });
        setIsResolving(false);
        setRefreshKey(k => k + 1);
      } catch (err: any) {
        alert(err.message || 'Failed to resolve allocation');
      }
    };

    if (isResolving) {
      // Need to import POLineSearchInput to use it here.
      // But we can't add imports with ReplacementChunks easily if it's already there or not.
      // Assuming it's not imported, I will add the import at the top of the file in another chunk.
      return (
        <div className="flex items-center gap-2 h-full">
          <div style={{ width: 180 }}>
            <POLineSearchInput
              productId={line.productId!}
              vendorId={invoice.vendorId}
              onSelect={(id) => setPoLineId(id)}
              placeholder="Find PO..."
            />
          </div>
          {poLineId && (
            <button
              onClick={handleResolve}
              className="btn btn-primary btn-sm"
              style={{ padding: '0 6px', height: 26, fontSize: 11 }}
            >
              {tCommon('save')}
            </button>
          )}
          <button
            onClick={() => {
              setIsResolving(false);
              setPoLineId('');
            }}
            className="btn btn-secondary btn-sm"
            style={{ padding: '0 6px', height: 26, fontSize: 11 }}
          >
            {/* eslint-disable-next-line i18next/no-literal-string */}
            ✕
          </button>
        </div>
      );
    }

    return (
      <div className="flex items-center justify-start w-full h-full">
        <button
          onClick={() => setIsResolving(true)}
          className="btn btn-secondary btn-sm"
          style={{ padding: '0 8px', height: 24, fontSize: 11 }}
        >
          {/* eslint-disable-next-line i18next/no-literal-string */}
          Allocate
        </button>
      </div>
    );
  };

  return (
    <DetailsLayout
      header={
        <EntityHeader
          title={invoice.invoiceNumber}
          subtitle={invoice.supplierInvoiceNumber ? `Supplier Ref: ${invoice.supplierInvoiceNumber}` : undefined}
          onBack={() => router.push('/purchase-invoices')}
          badges={<StateBadge state={invoice.stateCode as ValidState} />}
          actions={
            invoice.purchaseOrderId ? (
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => router.push(`/purchase-orders/${invoice.purchaseOrderId}`)}
              >
                View Purchase Order
              </button>
            ) : null
          }
        />
      }
    >
      <div className="flex flex-col gap-3">
        <div className="card">
          <h3 className="section-heading">
            {/* eslint-disable-next-line i18next/no-literal-string */}
            <span className="material-symbols-outlined">receipt_long</span>
            Invoice Details
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>
                System Bill No.
              </label>
              <div className="text-sm font-semibold">{invoice.invoiceNumber}</div>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>
                Supplier Invoice No.
              </label>
              <div className="text-sm">{invoice.supplierInvoiceNumber || '—'}</div>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>
                {tCommon('columns.currency')}
              </label>
              <div className="text-sm">{invoice.currencyCode}</div>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>
                Receipt Filename
              </label>
              <div className="text-sm">{invoice.receiptFilename || '—'}</div>
            </div>
            {invoice.notes && (
              <div className="col-span-2 mt-2">
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>
                  {tCommon('notesCardHeading')}
                </label>
                <div className="text-sm bg-gray-50 p-3 rounded">{invoice.notes}</div>
              </div>
            )}
          </div>
        </div>

        <div className="card">
          <h3 className="section-heading">
            {/* eslint-disable-next-line i18next/no-literal-string */}
            <span className="material-symbols-outlined">list</span>
            {t('lineItems')}
          </h3>
          <table className="table-lines">
            <thead>
              <tr>
                <th style={{ width: 40 }}>#</th>
                <th style={{ width: 150 }}>{t('columns.product')}</th>
                <th>{t('columns.description')}</th>
                <th style={{ width: 250 }}>PO Allocation</th>
                <th style={{ width: 110, textAlign: 'right' }}>{t('columns.qtyToBill', { defaultValue: 'Qty' })}</th>
                <th style={{ width: 130, textAlign: 'right' }}>{t('columns.unitPrice')}</th>
                <th style={{ width: 130, textAlign: 'right' }}>{t('columns.amount')}</th>
              </tr>
            </thead>
            <tbody>
              {invoice.lines?.map((line, idx) => (
                <tr key={line.lineId}>
                  <td style={{ color: 'var(--text-muted)' }}>{idx + 1}</td>
                  <td>
                    {line.productId && line.productId !== '00000000-0000-0000-0000-000000000000' ? (
                      <div className="font-semibold text-[12px]" style={{ color: 'var(--accent)' }}>
                        {line.productNumber || line.productId.substring(0, 8)}
                      </div>
                    ) : (
                      <span style={{ color: 'var(--text-muted)' }}>—</span>
                    )}
                  </td>
                  <td>
                    <div>{line.description || '—'}</div>
                  </td>
                  <td>
                    <InvoiceAllocationCell line={line} />
                  </td>
                  <td style={{ textAlign: 'right' }}>{parseFloat(line.quantityInvoiced)}</td>
                  <td style={{ textAlign: 'right' }}>{formatAmount(parseFloat(line.pricePerUnit), invoice.currencyCode)}</td>
                  <td style={{ textAlign: 'right', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                    {formatAmount(parseFloat(line.amount), invoice.currencyCode)}
                  </td>
                </tr>
              ))}
              {(!invoice.lines || invoice.lines.length === 0) && (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '20px 0' }}>
                    No items
                  </td>
                </tr>
              )}
              <tr style={{ borderTop: '2px solid var(--border)' }}>
                <td colSpan={6} style={{ textAlign: 'right', fontWeight: 600, color: 'var(--text-muted)' }}>
                  {tCommon('subtotal')}
                </td>
                <td style={{ textAlign: 'right', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                  {formatAmount(parseFloat(invoice.totalAmount) - parseFloat(invoice.taxAmount), invoice.currencyCode)}
                </td>
              </tr>
              <tr>
                <td colSpan={6} style={{ textAlign: 'right', fontWeight: 600, color: 'var(--text-muted)' }}>
                  {tCommon('tax')}
                </td>
                <td style={{ textAlign: 'right', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                  {formatAmount(parseFloat(invoice.taxAmount), invoice.currencyCode)}
                </td>
              </tr>
              <tr style={{ backgroundColor: 'rgba(59,130,246,0.02)' }}>
                <td colSpan={6} style={{ textAlign: 'right', fontWeight: 700, fontSize: 13, color: 'var(--text-primary)' }}>
                  {tCommon('total')}
                </td>
                <td style={{ textAlign: 'right', fontWeight: 800, fontSize: 14, color: 'var(--accent)', fontVariantNumeric: 'tabular-nums' }}>
                  {formatAmount(parseFloat(invoice.totalAmount), invoice.currencyCode)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </DetailsLayout>
  );
}

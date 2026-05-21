'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import EntityHeader from '@/components/shared/EntityHeader';
import DetailsLayout from '@/components/shared/DetailsLayout';
import StateBadge from '@/components/StateBadge';
import { formatAmount } from '@/lib/currency';
import { ValidState } from '@/types/states';
import Link from 'next/link';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useSalesInvoice } from './useSalesInvoice';

export default function InvoiceDetailContent({ id }: { id: string }) {
  const router = useRouter();
  const tCommon = useTranslations('common');
  const t = useTranslations('salesInvoices');
  const { invoice, loading, error } = useSalesInvoice(id);

  useDocumentTitle(invoice ? `Invoice ${invoice.invoiceNumber}` : t('loading'));

  if (loading) return <div className="p-8">{t('loadingEllipsis')}</div>;
  if (error) return <div className="p-8 text-red-500">{t('errorLoading', { message: error.message })}</div>;
  if (!invoice) return <div className="p-8 text-red-500">{t('notFound')}</div>;

  return (
    <DetailsLayout
      header={
        <EntityHeader
          title={invoice.invoiceNumber}
          subtitle={`Customer: ${invoice.customerName}`}
          onBack={() => router.push('/sales-invoices')}
          badges={<StateBadge state={invoice.stateCode as ValidState} />}
          actions={null}
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
                Customer
              </label>
              <div className="text-sm">
                {invoice.customerId ? (
                  <Link 
                    href={`/accounts/${invoice.customerId}`} 
                    className="text-[var(--accent)] hover:underline font-medium"
                  >
                    {invoice.customerName || t('unknownCustomer')}
                  </Link>
                ) : (
                  invoice.customerName || t('unknownCustomer')
                )}
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>
                Order No.
              </label>
              <div className="text-sm">
                {invoice.salesOrderId ? (
                  <Link
                    href={`/sales-orders/${invoice.salesOrderId}`}
                    className="text-[var(--accent)] hover:underline font-medium"
                  >
                    {invoice.orderNumber}
                  </Link>
                ) : (
                  invoice.orderNumber || '—'
                )}
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>
                {tCommon('columns.currency')}
              </label>
              <div className="text-sm">{invoice.currencyCode}</div>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>
                Date
              </label>
              <div className="text-sm">{new Date(invoice.createdOn).toLocaleDateString()}</div>
            </div>
            <div className="col-span-2 mt-2">
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>
                {tCommon('notesCardHeading')}
              </label>
              {invoice.notes ? (
                <div className="text-sm bg-gray-50 p-3 rounded">{invoice.notes}</div>
              ) : (
                <div className="text-sm" style={{ color: 'var(--text-muted)' }}>—</div>
              )}
            </div>
          </div>
        </div>

        <div className="card">
          <h3 className="section-heading">
            {/* eslint-disable-next-line i18next/no-literal-string */}
            <span className="material-symbols-outlined">list</span>
            Line Items
          </h3>
          <table className="table-lines">
            <thead>
              <tr>
                <th style={{ width: 40 }}>#</th>
                <th style={{ width: 150 }}>Product</th>
                <th>Description</th>
                <th style={{ width: 90, textAlign: 'right' }}>Qty</th>
                <th style={{ width: 110, textAlign: 'right' }}>Price</th>
                <th style={{ width: 110, textAlign: 'right' }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {invoice.lines?.map((line, idx) => (
                <tr key={line.lineId}>
                  <td style={{ color: 'var(--text-muted)' }}>{idx + 1}</td>
                  <td>
                    <div className="font-semibold" style={{ color: 'var(--accent)' }}>
                      {line.productNumber}
                    </div>
                  </td>
                  <td>{line.description || '—'}</td>
                  <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                    {parseFloat(line.quantityInvoiced)}
                  </td>
                  <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                    {formatAmount(parseFloat(line.pricePerUnit), invoice.currencyCode)}
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                    {formatAmount(parseFloat(line.amount), invoice.currencyCode)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ borderTop: '2px solid var(--border)' }}>
                <td colSpan={5} style={{ textAlign: 'right', fontWeight: 600, color: 'var(--text-muted)' }}>
                  {tCommon('subtotal')}
                </td>
                <td style={{ textAlign: 'right', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                  {formatAmount(parseFloat(invoice.totalAmount) - parseFloat(invoice.taxAmount), invoice.currencyCode)}
                </td>
              </tr>
              <tr>
                <td colSpan={5} style={{ textAlign: 'right', fontWeight: 600, color: 'var(--text-muted)' }}>
                  {tCommon('tax')}
                </td>
                <td style={{ textAlign: 'right', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                  {formatAmount(parseFloat(invoice.taxAmount), invoice.currencyCode)}
                </td>
              </tr>
              <tr style={{ backgroundColor: 'rgba(59,130,246,0.02)' }}>
                <td colSpan={5} style={{ textAlign: 'right', fontWeight: 700, fontSize: 13, color: 'var(--text-primary)' }}>
                  {tCommon('total')}
                </td>
                <td style={{ textAlign: 'right', fontWeight: 800, fontSize: 14, color: 'var(--accent)', fontVariantNumeric: 'tabular-nums' }}>
                  {formatAmount(parseFloat(invoice.totalAmount), invoice.currencyCode)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Payment Allocations Card */}
        <div className="card mt-4 p-5">
          <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4">Payment Allocations</h2>
          <p className="text-sm text-gray-500">
            When payments are allocated to this invoice from the Payment Manager, they will appear here.
          </p>
        </div>
      </div>
    </DetailsLayout>
  );
}

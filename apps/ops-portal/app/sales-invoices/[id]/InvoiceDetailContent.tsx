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
import { useAuth } from '@/components/AuthGate';
import MobileLineItemCard from '@/components/shared/MobileLineItemCard';

import * as api from '@herobm/sdk';
import { getErrorMessage, SALES_INVOICE_STATE, calculateEarlyPaymentDiscount } from '@herobm/shared';

export default function InvoiceDetailContent({ id }: { id: string }) {
  const router = useRouter();
  const tCommon = useTranslations('common');
  const t = useTranslations('salesInvoices');
  const { permissions } = useAuth();
  const canManageGL = permissions.some(p => p.resource === 'gl' && p.action === 'write');
  const { invoice, loading, error } = useSalesInvoice(id);
  const [cancelling, setCancelling] = React.useState(false);
  const [markingPaid, setMarkingPaid] = React.useState(false);

  useDocumentTitle(invoice ? `Invoice ${invoice.invoiceNumber}` : t('loading'));

  if (loading) return <div className="p-8">{t('loadingEllipsis')}</div>;
  if (error) return <div className="p-8 text-red-500">{t('errorLoading', { message: error.message })}</div>;
  if (!invoice) return <div className="p-8 text-red-500">{t('notFound')}</div>;

  const handleCancel = async () => {
    if (!window.confirm('Are you sure you want to cancel this invoice? This will reverse the GL postings.')) return;
    setCancelling(true);
    try {
      await api.invoiceDetailControllerChangeSalesInvoiceState(id, { stateCode: SALES_INVOICE_STATE.CANCELLED });
      window.location.reload();
    } catch (err: unknown) {
      alert(getErrorMessage(err) || 'Failed to cancel invoice');
    } finally {
      setCancelling(false);
    }
  };

  const handleAdminMarkPaid = async () => {
    if (!window.confirm('This will mark the invoice as paid without generating a GL entry. Proceed?')) return;
    setMarkingPaid(true);
    try {
      await api.invoiceDetailControllerAdminMarkSalesInvoicePaid(id, {});
      window.location.reload();
    } catch (err: unknown) {
      alert(getErrorMessage(err) || 'Failed to mark as paid');
    } finally {
      setMarkingPaid(false);
    }
  };

  return (
    <DetailsLayout
      header={
        <EntityHeader
          title={invoice.invoiceNumber}
          subtitle={`Customer: ${invoice.customerName}`}
          onBack={() => router.push('/sales-invoices')}
          badges={<StateBadge state={invoice.stateCode as ValidState} />}
          actions={
            <div className="flex items-center gap-2">

              {invoice.stateCode !== SALES_INVOICE_STATE.CANCELLED && (
                <button
                  className="btn btn-secondary btn-sm text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300"
                  onClick={handleCancel}
                  disabled={cancelling}
                >
                  {cancelling ? tCommon('saving') : tCommon('cancel')}
                </button>
              )}
            </div>
          }
        />
      }
    >
      <div className="flex flex-col gap-3">
        <div className="card">
          <h3 className="section-heading flex items-center gap-2 mb-4">
            { }
            <span className="material-symbols-outlined shrink-0">receipt_long</span>
            <span>{t('invoiceDetails')}</span>
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>
                {t('customer')}
              </label>
              <div className="text-sm">
                {invoice.customerId ? (
                  <Link 
                    href={`/customers/${invoice.customerId}`} 
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
                {t('orderNo')}
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
                {t('date')}
              </label>
              <div className="text-sm">{new Date(invoice.createdOn).toLocaleDateString()}</div>
            </div>
            {invoice.earlyPaymentDiscount != null && invoice.earlyPaymentDiscountDays != null && (
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>
                  Early Payment Terms
                </label>
                <div className="text-sm">
                  {(() => {
                    const result = calculateEarlyPaymentDiscount({
                      invoiceDate: new Date(invoice.createdOn),
                      outstandingAmount: invoice.outstandingAmount,
                      earlyPaymentDiscount: invoice.earlyPaymentDiscount,
                      earlyPaymentDiscountDays: invoice.earlyPaymentDiscountDays,
                    });
                    const dateLimit = result.eligibleUntil ? result.eligibleUntil.toLocaleDateString() : '';
                    
                    if (result.isEligible) {
                      return `${invoice.earlyPaymentDiscount}% (${formatAmount(result.discountAmount, invoice.currencyCode)}) in ${invoice.earlyPaymentDiscountDays} days (${dateLimit})`;
                    }
                    
                    return (
                      <>
                        { }
                        <span className="text-[var(--text-muted)]">
                          {tCommon('earlyPaymentDiscountExpired', { discount: invoice.earlyPaymentDiscount, days: invoice.earlyPaymentDiscountDays, dateLimit })}
                        </span>
                      </>
                    );
                  })()}
                </div>
              </div>
            )}
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
          <div className="flex items-center justify-between mb-4">
            <h3 className="section-heading flex items-center gap-2">
              {/* eslint-disable-next-line i18next/no-literal-string -- Hardcoded string exceptions for standard system IDs, technical constants, or non-translatable symbols (e.g., -- Material UI Icon). */}
              <span className="material-symbols-outlined shrink-0">list</span>
              <span>{t('lineItems')}</span>
            </h3>
          </div>
          {/* Desktop Table */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="table-lines min-w-[600px]">
              <thead>
              <tr>
                <th style={{ width: 40 }}>#</th>
                <th style={{ width: 150 }}>{t('columns.product')}</th>
                <th>{t('columns.description')}</th>
                <th style={{ width: 90, textAlign: 'right' }}>{t('columns.qty')}</th>
                <th style={{ width: 110, textAlign: 'right' }}>{t('columns.price')}</th>
                <th style={{ width: 110, textAlign: 'right' }}>{t('columns.amount')}</th>
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

          {/* Mobile Cards */}
          <div className="flex flex-col lg:hidden mt-2">
            {invoice.lines?.map((line, idx) => (
              <MobileLineItemCard
                key={line.lineId}
                title={line.productNumber}
                subtitle={line.description || '—'}
                topRightBadge={`#${idx + 1}`}
                details={[
                  {
                    label: t('columns.qty'),
                    value: parseFloat(line.quantityInvoiced)
                  },
                  {
                    label: t('columns.price'),
                    value: formatAmount(parseFloat(line.pricePerUnit), invoice.currencyCode)
                  },
                  {
                    label: t('columns.amount'),
                    value: formatAmount(parseFloat(line.amount), invoice.currencyCode),
                    isHighlighted: true
                  }
                ]}
              />
            ))}
            {(!invoice.lines || invoice.lines.length === 0) && (
              <div className="text-center text-sm text-[var(--text-muted)] py-4 border border-[var(--border)] rounded-lg">
                {tCommon('orderReadView.noLineItems')}
              </div>
            )}
            
            {/* Mobile Summary */}
            <div className="mt-2 bg-[var(--bg-card)] rounded-xl border border-[var(--border)] p-4">
              <table className="w-full text-sm">
                <tbody>
                  <tr>
                    <td className="py-1 text-xs font-medium text-slate-500 text-right pr-4">{tCommon('subtotal')}</td>
                    <td className="py-1 text-sm font-semibold text-right tabular-nums">
                      {formatAmount(parseFloat(invoice.totalAmount) - parseFloat(invoice.taxAmount), invoice.currencyCode)}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-1 text-xs font-medium text-slate-500 text-right pr-4">{tCommon('tax')}</td>
                    <td className="py-1 text-sm font-semibold text-right tabular-nums">
                      {formatAmount(parseFloat(invoice.taxAmount), invoice.currencyCode)}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2 text-sm font-bold text-[var(--accent)] text-right pr-4">{tCommon('total')}</td>
                    <td className="py-2 text-base font-bold text-[var(--accent)] text-right tabular-nums">
                      {formatAmount(parseFloat(invoice.totalAmount), invoice.currencyCode)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Payment Allocations Card */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="section-heading flex items-center gap-2">
              { }
              <span className="material-symbols-outlined shrink-0">payments</span>
              <span>{t('paymentAllocations')}</span>
            </h3>
            {invoice.stateCode !== SALES_INVOICE_STATE.PAID && invoice.stateCode !== SALES_INVOICE_STATE.CANCELLED && canManageGL && (
              <button
                className="btn btn-secondary btn-sm"
                onClick={handleAdminMarkPaid}
                disabled={markingPaid}
              >
                {markingPaid ? tCommon('loadingEllipsis') : tCommon('markPaid')}
              </button>
            )}
          </div>
          {invoice.allocations && invoice.allocations.length > 0 ? (
            <div className="overflow-x-auto -mx-5 sm:mx-0 px-5 sm:px-0">
              <table className="table-lines min-w-[500px]">
                <thead>
                  <tr>
                    <th style={{ width: 150 }}>{t('columns.paymentNo')}</th>
                    <th style={{ width: 150 }}>{t('columns.date')}</th>
                    <th style={{ textAlign: 'right' }}>{t('columns.allocatedAmount')}</th>
                  </tr>
                </thead>
                <tbody>
                  {invoice.allocations.map((alloc) => (
                    <tr key={alloc.allocationId}>
                      <td className="font-semibold text-[var(--accent)]">
                        <span className="cursor-pointer hover:underline" onClick={() => router.push(`/payments?paymentId=${alloc.paymentId}`)}>
                          {alloc.paymentNumber}
                        </span>
                      </td>
                      <td style={{ color: 'var(--text-secondary)' }}>
                        {new Date(alloc.paymentDate).toLocaleDateString()}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                        {formatAmount(parseFloat(alloc.allocatedAmount), alloc.currencyCode)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="overflow-x-auto -mx-5 sm:mx-0 px-5 sm:px-0">
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                {t('paymentAllocationsDesc')}
              </p>
            </div>
          )}
        </div>
      </div>
    </DetailsLayout>
  );
}

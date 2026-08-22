'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import EntityHeader from '@/components/shared/EntityHeader';
import DetailsLayout from '@/components/shared/DetailsLayout';
import StateBadge from '@/components/StateBadge';
import { formatAmount } from '@/lib/currency';
import { formatLocalDate } from '@/lib/date';
import { ValidState } from '@/types/states';
import Link from 'next/link';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useSalesInvoice, SalesInvoiceDetails } from './useSalesInvoice';
import { useAuth } from '@/components/AuthGate';
import MobileLineItemCard from '@/components/shared/MobileLineItemCard';
import EntityBanner from '@/components/shared/EntityBanner';
import ActivityTimeline from '@/components/shared/ActivityTimeline';
import { DataTable, DataTableColumn } from '@/components/shared/DataTable';
import EmailDocumentDialog from '@/components/shared/EmailDocumentDialog';
import { Button } from '@/components/shared/Button';

import * as api from '@herobm/sdk';
import { getErrorMessage, SALES_INVOICE_STATE, calculateEarlyPaymentDiscount } from '@herobm/shared';

export default function InvoiceDetailContent({ id }: { id: string }) {
  const router = useRouter();
  const tCommon = useTranslations('common');
  const t = useTranslations('salesInvoices');
  const { permissions } = useAuth();
  const canManageGL = permissions.some(p => p.resource === 'gl' && p.action === 'write');
  const { invoice, loading, error } = useSalesInvoice(id as string);
  const [cancelling, setCancelling] = React.useState(false);
  const [markingPaid, setMarkingPaid] = React.useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = React.useState(false);
  const [emailDialogConfig, setEmailDialogConfig] = React.useState<{
    isOpen: boolean;
    mode?: 'email' | 'print';
    hookSlug: string;
    title: string;
    prefix: string;
    docName: string;
    targetId?: string;
    contextSlug?: string;
  }>({
    isOpen: false,
    mode: 'email',
    hookSlug: '',
    title: '',
    prefix: '',
    docName: ''
  });

  useDocumentTitle(
    invoice
      ? invoice.customerName
        ? `${invoice.invoiceNumber} - ${invoice.customerName}`
        : invoice.invoiceNumber
      : null,
  );

  if (loading) return <div className="p-8">{t('loadingEllipsis')}</div>;
  if (error) return <div className="p-8 text-red-500">{t('errorLoading', { message: error.message })}</div>;
  if (!invoice) return <div className="p-8 text-red-500">{t('notFound')}</div>;

  const handlePrintInvoice = () => {
    if (!invoice) return;
    setEmailDialogConfig({
      isOpen: true,
      mode: 'print',
      hookSlug: 'sales-invoice',
      title: 'Print Sales Invoice',
      prefix: 'Invoice',
      docName: 'Sales Invoice',
      targetId: invoice.invoiceId,
      contextSlug: 'sales-invoice',
    });
  };

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

  const isOverdue = invoice.dueDate && new Date(invoice.dueDate) < new Date() && Number(invoice.outstandingAmount) > 0 && invoice.stateCode !== SALES_INVOICE_STATE.CANCELLED;

  const lineColumns: DataTableColumn<SalesInvoiceDetails['lines'][0]>[] = [
    {
      id: 'index',
      header: '#',
      width: 40,
      render: (_, i) => <span className="text-[var(--text-muted)]">{i + 1}</span>,
    },
    {
      id: 'product',
      header: t('columns.product'),
      width: 150,
      render: (line) => (
        <Link href={`/products/${line.productId}`} className="font-semibold hover:underline text-[var(--accent)]">
          {line.productNumber}
        </Link>
      )
    },
    {
      id: 'description',
      header: t('columns.description'),
      render: (line) => line.description || '—',
    },
    {
      id: 'qty',
      header: t('columns.qty'),
      width: 90,
      align: 'right',
      render: (line) => <span className="tabular-nums">{parseFloat(line.quantityInvoiced)}</span>,
    },
    {
      id: 'price',
      header: t('columns.price'),
      width: 110,
      align: 'right',
      render: (line) => <span className="tabular-nums">{formatAmount(parseFloat(line.pricePerUnit), invoice.currencyCode)}</span>,
    },
    {
      id: 'amount',
      header: t('columns.amount'),
      width: 110,
      align: 'right',
      render: (line) => (
        <span className="font-semibold tabular-nums">
          {formatAmount(parseFloat(line.amount), invoice.currencyCode)}
        </span>
      ),
    }
  ];

  const allocationColumns: DataTableColumn<NonNullable<SalesInvoiceDetails['allocations']>[0]>[] = [
    {
      id: 'paymentNo',
      header: t('columns.paymentNo'),
      width: 250,
      render: (alloc) => (
        <span className="font-semibold cursor-pointer hover:underline text-[var(--accent)]" onClick={() => router.push(`/payments?paymentId=${alloc.paymentId}`)}>
          {alloc.paymentNumber}
        </span>
      ),
    },
    {
      id: 'date',
      header: t('columns.date'),
      width: 150,
      render: (alloc) => (
        <span className="text-[var(--text-secondary)]">
          {formatLocalDate(alloc.paymentDate)}
        </span>
      ),
    },
    {
      id: 'allocatedAmount',
      header: t('columns.allocatedAmount'),
      align: 'right',
      render: (alloc) => (
        <span className="font-semibold tabular-nums">
          {formatAmount(parseFloat(alloc.allocatedAmount), alloc.currencyCode)}
        </span>
      ),
    }
  ];

  const linesFooter = (
    <>
      <tr className="border-t-2 border-[var(--border)]">
        <td colSpan={5} className="text-right font-semibold text-[var(--text-muted)]">
          {tCommon('subtotal')}
        </td>
        <td className="text-right font-semibold tabular-nums">
          {formatAmount(parseFloat(invoice.totalAmount) - parseFloat(invoice.taxAmount), invoice.currencyCode)}
        </td>
      </tr>
      <tr>
        <td colSpan={5} className="text-right font-semibold text-[var(--text-muted)]">
          {tCommon('tax')}
        </td>
        <td className="text-right font-semibold tabular-nums">
          {formatAmount(parseFloat(invoice.taxAmount), invoice.currencyCode)}
        </td>
      </tr>
      <tr className="bg-blue-500/[0.02]">
        <td colSpan={5} className="text-right font-bold text-[13px] text-[var(--text-primary)]">
          {tCommon('total')}
        </td>
        <td className="text-right font-extrabold text-[14px] text-[var(--accent)] tabular-nums">
          {formatAmount(parseFloat(invoice.totalAmount), invoice.currencyCode)}
        </td>
      </tr>
    </>
  );

  return (
    <DetailsLayout
      header={
        <EntityHeader
          title={invoice.invoiceNumber}
          subtitle={`Customer: ${invoice.customerName}`}
          actions={
            <div className="flex items-center gap-2">
              {invoice.stateCode !== SALES_INVOICE_STATE.CANCELLED && (
                <>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handlePrintInvoice}
                    disabled={isGeneratingPdf}
                  >
                    <span className="material-symbols-outlined text-[16px] mr-1">print</span>
                    {isGeneratingPdf ? tCommon('loading') : t('printInvoice')}
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setEmailDialogConfig({
                      isOpen: true,
                      hookSlug: 'sales-invoice',
                      title: 'Email Sales Invoice',
                      prefix: 'Invoice',
                      docName: 'Sales Invoice',
                      targetId: invoice.invoiceId,
                      contextSlug: 'sales-invoice'
                    })}
                  >
                    <span className="material-symbols-outlined text-[16px] mr-1">mail</span>
                    {t('emailInvoice')}
                  </Button>
                </>
              )}
              {invoice.stateCode !== SALES_INVOICE_STATE.CANCELLED && (
                <Button
                  variant="danger"
                  size="sm"
                  onClick={handleCancel}
                  disabled={cancelling}
                >
                  {cancelling ? tCommon('saving') : tCommon('cancel')}
                </Button>
              )}
            </div>
          }
        />
      }
    >
      <div className="flex flex-col gap-3">
        {isOverdue && (
          <div className="px-4 lg:px-6 pt-4">
            <EntityBanner
              type="error"
              title="Invoice Overdue"
              description={`This invoice is overdue by ${Math.floor((new Date().getTime() - new Date(invoice.dueDate!).getTime()) / (1000 * 3600 * 24))} days. The outstanding balance is ${formatAmount(parseFloat(invoice.outstandingAmount), invoice.currencyCode)}.`}
            />
          </div>
        )}
        <div id="details-section" className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="section-heading flex items-center gap-2">
              { }
              <span className="material-symbols-outlined shrink-0">receipt_long</span>
              <span>{t('invoiceDetails')}</span>
            </h3>
            {invoice.stateCode !== SALES_INVOICE_STATE.CANCELLED && (
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handlePrintInvoice}
                  disabled={isGeneratingPdf}
                >
                  <span className="material-symbols-outlined text-[16px] mr-1">print</span>
                  {isGeneratingPdf ? tCommon('loading') : t('printInvoice')}
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setEmailDialogConfig({
                    isOpen: true,
                    hookSlug: 'sales-invoice',
                    title: 'Email Sales Invoice',
                    prefix: 'Invoice',
                    docName: 'Sales Invoice',
                    targetId: invoice.invoiceId,
                    contextSlug: 'sales-invoice'
                  })}
                >
                  <span className="material-symbols-outlined text-[16px] mr-1">mail</span>
                  {t('emailInvoice')}
                </Button>
              </div>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium mb-1 text-[var(--text-muted)]">
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
              <label className="block text-xs font-medium mb-1 text-[var(--text-muted)]">
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
              <label className="block text-xs font-medium mb-1 text-[var(--text-muted)]">
                {t('customerPO')}
              </label>
              <div className="text-sm">{invoice.customerOrderNumber || '—'}</div>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1 text-[var(--text-muted)]">
                {tCommon('columns.currency')}
              </label>
              <div className="text-sm">{invoice.currencyCode}</div>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1 text-[var(--text-muted)]">
                {t('date')}
              </label>
              <div className="text-sm">{formatLocalDate(invoice.invoiceDate || invoice.createdOn)}</div>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1 text-[var(--text-muted)]">
                Trading Terms
              </label>
              <div className="text-sm">{invoice.termsDescription || '—'}</div>
            </div>

            {invoice.earlyPaymentDiscount != null && invoice.earlyPaymentDiscountDays != null && (
              <div>
                <label className="block text-xs font-medium mb-1 text-[var(--text-muted)]">
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
                    const dateLimit = result.eligibleUntil ? formatLocalDate(result.eligibleUntil, undefined, '') : '';
                    
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
              <label className="block text-xs font-medium mb-1 text-[var(--text-muted)]">
                {tCommon('notesCardHeading')}
              </label>
              {invoice.notes ? (
                <div className="text-sm">{invoice.notes}</div>
              ) : (
                <div className="text-sm text-[var(--text-muted)]">—</div>
              )}
            </div>
          </div>
        </div>



        {/* Status Card */}
        <div className="card">
          <h3 className="section-heading mb-4 flex items-center gap-2">
            <span className="material-symbols-outlined shrink-0">info</span>
            <span>Invoice Status</span>
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div>
              <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">Status</label>
              {isOverdue ? (
                <span className="badge badge-overdue">{tCommon('states.overdue')}</span>
              ) : (
                <StateBadge state={invoice.stateCode as ValidState} />
              )}
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">Total Due</label>
              <div className="text-lg font-semibold text-[var(--text-primary)]">
                {formatAmount(parseFloat(invoice.outstandingAmount), invoice.currencyCode)}
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">Total Paid</label>
              <div className="text-lg font-semibold text-[var(--text-primary)]">
                {formatAmount(parseFloat(invoice.totalAmount) - parseFloat(invoice.outstandingAmount), invoice.currencyCode)}
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">Due Date</label>
              <div className={`text-lg font-semibold ${isOverdue ? 'text-red-600' : 'text-[var(--text-primary)]'}`}>
                {formatLocalDate(invoice.dueDate)}
              </div>
            </div>
          </div>
        </div>

        <div id="lines-section" className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="section-heading flex items-center gap-2">
              {/* eslint-disable-next-line i18next/no-literal-string -- Material UI Icon */}
              <span className="material-symbols-outlined shrink-0">list</span>
              <span>{t('lineItems')}</span>
            </h3>
          </div>
          {/* Line Items Table */}
          <DataTable
            data={invoice.lines || []}
            columns={lineColumns}
            keyExtractor={(line) => line.lineId}
            emptyMessage={tCommon('orderReadView.noLineItems')}
            footer={linesFooter}
            mobileCard={(line, idx) => (
              <MobileLineItemCard
                title={
                  <Link href={`/products/${line.productId}`} className="hover:underline">
                    {line.productNumber}
                  </Link>
                }
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
            )}
          />

          {/* Mobile Summary */}
          <div className="flex flex-col lg:hidden mt-2">
            <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] p-4">
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
        <div id="payments-section" className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="section-heading flex items-center gap-2">
              { }
              <span className="material-symbols-outlined shrink-0">payments</span>
              <span>{t('paymentAllocations')}</span>
            </h3>
            {invoice.stateCode !== SALES_INVOICE_STATE.PAID && invoice.stateCode !== SALES_INVOICE_STATE.CANCELLED && canManageGL && (
              <Button
                variant="secondary"
                size="sm"
                onClick={handleAdminMarkPaid}
                disabled={markingPaid}
              >
                {markingPaid ? tCommon('loadingEllipsis') : tCommon('markPaid')}
              </Button>
            )}
          </div>
          <DataTable
            data={invoice.allocations || []}
            columns={allocationColumns}
            keyExtractor={(alloc) => alloc.allocationId}
            emptyMessage={t('paymentAllocationsDesc')}
            mobileCard={(alloc) => (
              <MobileLineItemCard
                title={
                  <span className="cursor-pointer hover:underline font-semibold text-[var(--accent)]" onClick={() => router.push(`/payments?paymentId=${alloc.paymentId}`)}>
                    {alloc.paymentNumber}
                  </span>
                }
                subtitle={formatLocalDate(alloc.paymentDate)}
                details={[
                  {
                    label: t('columns.allocatedAmount'),
                    value: formatAmount(parseFloat(alloc.allocatedAmount), alloc.currencyCode),
                    isHighlighted: true
                  }
                ]}
              />
            )}
          />
        </div>

        <div id="activity-section" className="card">
          <ActivityTimeline 
            events={invoice.events && invoice.events.length > 0 ? invoice.events : [{
              eventId: `import-${invoice.invoiceId}`,
              eventType: 'imported',
              payload: { note: 'Invoice imported from legacy system' },
              actor: 'System',
              createdOn: invoice.createdOn
            }]} 
          />
        </div>
      </div>
      <EmailDocumentDialog
        isOpen={emailDialogConfig.isOpen}
        mode={emailDialogConfig.mode || 'email'}
        orderId={invoice.salesOrderId!}
        orderNumber={invoice.invoiceNumber}
        customerReference={''}
        customerId={invoice.customerId!}
        hookSlug={emailDialogConfig.hookSlug}
        title={emailDialogConfig.title}
        defaultSubjectPrefix={emailDialogConfig.prefix}
        documentName={emailDialogConfig.docName}
        targetId={emailDialogConfig.targetId || ''}
        contextSlug={emailDialogConfig.contextSlug || ''}
        onClose={() => setEmailDialogConfig(prev => ({ ...prev, isOpen: false }))}
        onSuccess={() => {
          setEmailDialogConfig(prev => ({ ...prev, isOpen: false }));
          if (emailDialogConfig.mode !== 'print') {
            alert('Email queued successfully!');
          }
        }}
        onPreview={async (customPdfText?: string) => {
          try {
            const response = await api.pdfTemplatesControllerRunHook(emailDialogConfig.hookSlug, { customPdfText }, { 
              id: invoice.invoiceId, 
              context: emailDialogConfig.contextSlug || 'sales-invoice'
            });
            const blob = new Blob([response.data as BlobPart], { type: 'application/pdf' });
            const url = window.URL.createObjectURL(blob);
            window.open(url, '_blank');
          } catch (err: unknown) {
            alert(getErrorMessage(err) || 'Failed to preview PDF');
          }
        }}
      />
    </DetailsLayout>
  );
}

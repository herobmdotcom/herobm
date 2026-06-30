'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import EntityHeader from '@/components/shared/EntityHeader';
import DetailsLayout from '@/components/shared/DetailsLayout';
import StateBadge, { StateName } from '@/components/StateBadge';
import { formatAmount } from '@/lib/currency';
import { ValidState } from '@/types/states';
import Link from 'next/link';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useSalesReturn, SalesReturnDetails } from './useSalesReturn';
import { useAuth } from '@/components/AuthGate';
import MobileLineItemCard from '@/components/shared/MobileLineItemCard';
import EntityBanner from '@/components/shared/EntityBanner';
import ActivityTimeline from '@/components/shared/ActivityTimeline';
import { DataTable, DataTableColumn } from '@/components/shared/DataTable';
import EmailDocumentDialog from '@/components/shared/EmailDocumentDialog';

import * as api from '@herobm/sdk';
import { getErrorMessage, RETURN_STATE, RETURN_TRANSITIONS } from '@herobm/shared';
import { useSettings } from '@/components/SettingsProvider';

function PurchaseReturnStateBadge({ state }: { state: ValidState }) {
    const t = useTranslations('common.states');
    return <span className={`badge badge-${state}`}>{t(state)}</span>;
}

export default function SalesReturnDetailContent({ id }: { id: string }) {
  const router = useRouter();
  const tCommon = useTranslations('common');
  const t = useTranslations('salesOrders');
  const { baseCurrency } = useSettings();
  const { permissions } = useAuth();
  
  const { ret, loading, error, fetchReturn } = useSalesReturn(id as string);
  const [saving, setSaving] = React.useState(false);
  const [emailDialogConfig, setEmailDialogConfig] = React.useState<{
    isOpen: boolean;
    hookSlug: string;
    title: string;
    prefix: string;
    docName: string;
    targetId?: string;
    contextSlug?: string;
  }>({
    isOpen: false,
    hookSlug: '',
    title: '',
    prefix: '',
    docName: ''
  });

  useDocumentTitle(ret ? `Return ${ret.returnNumber}` : 'Loading...');

  if (loading) return <div className="p-8">Loading...</div>;
  if (error) return <div className="p-8 text-red-500">{tCommon('errors.failedToCreateReturn')} {error.message}</div>;
  if (!ret) return <div className="p-8 text-red-500">Not found</div>;

  let allowedRetTransitions = RETURN_TRANSITIONS[ret.stateCode] || [];
  allowedRetTransitions = allowedRetTransitions.filter((s: string) => s !== RETURN_STATE.RECEIVED && s !== RETURN_STATE.PARTIALLY_RECEIVED && s !== RETURN_STATE.PROCESSED);
  
  const handleStateChange = async (newState: string) => {
    setSaving(true);
    try {
        await api.orderReturnsControllerChangeReturnState(ret.salesOrderId, ret.returnId, {
            stateCode: newState
        });
        await fetchReturn();
    } catch (err) {
        alert(getErrorMessage(err) || tCommon('errors.failedToChangeReturnState'));
    } finally {
        setSaving(false);
    }
  };

  const handleProcessReturn = async () => {
    if (!confirm('Are you sure you want to process this return?')) return;
    setSaving(true);
    try {
        await api.orderReturnsControllerChangeReturnState(ret.salesOrderId, ret.returnId, {
            stateCode: RETURN_STATE.PROCESSED
        });
        await fetchReturn();
    } catch (err) {
        alert(getErrorMessage(err) || 'Failed to process return');
    } finally {
        setSaving(false);
    }
  };

  const lineColumns: DataTableColumn<SalesReturnDetails['lines'][0]>[] = [
    {
      id: 'index',
      header: '#',
      width: 40,
      render: (_, i) => <span style={{ color: 'var(--text-muted)' }}>{i + 1}</span>,
    },
    {
      id: 'product',
      header: t('columns.product'),
      width: 150,
      render: (line) => (
        <Link href={`/products/${line.productId}`} className="font-semibold hover:underline" style={{ color: 'var(--accent)' }}>
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
      header: t('columns.returnQty'),
      width: 90,
      align: 'right',
      render: (line) => <span style={{ fontVariantNumeric: 'tabular-nums' }}>{parseFloat(line.quantityReturned)}</span>,
    },
    {
      id: 'reason',
      header: t('columns.reason'),
      width: 150,
      render: (line) => line.reason || '—',
    },
    {
      id: 'resolution',
      header: 'Resolution',
      width: 110,
      render: (line) => line.resolution || '—',
    },
    {
      id: 'fee',
      header: t('columns.fee'),
      width: 110,
      align: 'right',
      render: (line) => (
        <span style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
          {parseFloat(line.returnFee || '0') > 0 ? formatAmount(parseFloat(line.returnFee || '0'), ret.currencyCode) : '—'}
        </span>
      ),
    }
  ];

  return (
    <DetailsLayout
      header={
        <EntityHeader
          title={ret.returnNumber}
          subtitle={`Order: ${ret.salesOrderNumber}`}
          actions={
            <div className="flex gap-2">
                {allowedRetTransitions.map((s: string) => (
                    <button
                        key={s}
                        disabled={saving}
                        className={`btn btn-sm ${s === 'cancelled' ? 'btn-danger' : 'btn-primary'}`}
                        onClick={() => handleStateChange(s)}
                    >
                        → <StateName state={s as ValidState} />
                    </button>
                ))}
                {ret.stateCode === RETURN_STATE.RECEIVED && (
                    <button
                        className="btn btn-primary btn-sm"
                        disabled={saving}
                        onClick={handleProcessReturn}
                    >
                        Process Return
                    </button>
                )}
            </div>
          }
          badges={<PurchaseReturnStateBadge state={ret.stateCode as ValidState} />}
        />
      }
    >
      <div className="flex flex-col gap-3">
        <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="section-heading">Return Details</h3>
              <div className="flex gap-2">
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => setEmailDialogConfig({
                    isOpen: true,
                    hookSlug: 'return-slip',
                    title: 'Email Return Slip',
                    prefix: 'Return Slip',
                    docName: 'Return Slip',
                    targetId: ret.returnId,
                    contextSlug: 'sales_return'
                  })}
                >
                  Email Slip
                </button>
                {ret.creditNoteNumber && (
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => setEmailDialogConfig({
                      isOpen: true,
                      hookSlug: 'sales-return-credit',
                      title: 'Email Credit Note',
                      prefix: 'Credit Note',
                      docName: 'Credit Note',
                      targetId: ret.returnId,
                      contextSlug: 'sales_return'
                    })}
                  >
                    Email Credit Note
                  </button>
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div>
                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">{t('columns.date')}</div>
                <div className="text-sm font-medium">{new Date(ret.createdOn).toLocaleDateString()}</div>
              </div>
              <div>
                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Customer</div>
                <div className="text-sm font-medium">
                  <Link href={`/customers/${ret.customerId}`} className="hover:underline text-[var(--accent)]">
                    {ret.customerName}
                  </Link>
                </div>
              </div>
              {ret.locationId && (
                  <div>
                    <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Location</div>
                    <div className="text-sm font-medium">{ret.locationName || ret.locationId}</div>
                  </div>
              )}
              {ret.creditNoteNumber && (
                <div>
                  <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Credit Note</div>
                  <div className="text-sm font-medium">{ret.creditNoteNumber}</div>
                </div>
              )}
            </div>
            {ret.notes && (
                <div className="mt-6">
                    <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Notes</div>
                    <div className="text-sm font-medium whitespace-pre-wrap">{ret.notes}</div>
                </div>
            )}
          </div>

          <div className="card mt-4">
            <h3 className="section-heading mb-4">Lines</h3>
            <DataTable
              data={ret.lines}
              columns={lineColumns}
              keyExtractor={(line) => line.returnLineId}
              emptyMessage="No lines found"
            />
          </div>

          <div className="mt-4">
            <ActivityTimeline
              events={ret.events?.map(e => ({
                eventId: e.eventId,
                eventType: e.eventType,
                actor: e.actor,
                createdOn: e.createdOn,
                payload: e.payload,
              })) || []}
            />
          </div>
      </div>
      <EmailDocumentDialog
        isOpen={emailDialogConfig.isOpen}
        orderId={ret.salesOrderId!}
        orderNumber={ret.returnNumber}
        customerReference={''}
        customerId={ret.customerId!}
        hookSlug={emailDialogConfig.hookSlug}
        title={emailDialogConfig.title}
        defaultSubjectPrefix={emailDialogConfig.prefix}
        documentName={emailDialogConfig.docName}
        targetId={emailDialogConfig.targetId || ''}
        contextSlug={emailDialogConfig.contextSlug || ''}
        onClose={() => setEmailDialogConfig(prev => ({ ...prev, isOpen: false }))}
        onSuccess={() => {
          setEmailDialogConfig(prev => ({ ...prev, isOpen: false }));
          alert('Email queued successfully!');
        }}
        onPreview={async (customPdfText?: string) => {
          try {
            const response = await api.pdfTemplatesControllerRunHook(emailDialogConfig.hookSlug, { customPdfText }, { 
              id: ret.returnId, 
              context: emailDialogConfig.contextSlug || ''
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

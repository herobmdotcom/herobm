'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import EntityHeader from '@/components/shared/EntityHeader';
import DetailsLayout from '@/components/shared/DetailsLayout';
import StateBadge, { StateName } from '@/components/StateBadge';
import { formatAmount } from '@/lib/currency';
import { formatLocalDate } from '@/lib/date';
import { formatLocationDisplay } from '@/lib/formatters';
import { ValidState } from '@/types/states';
import Link from 'next/link';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useSalesReturn, SalesReturnDetails } from './useSalesReturn';
import { useAuth } from '@/components/AuthGate';
import MobileLineItemCard from '@/components/shared/MobileLineItemCard';
import { Button } from '@/components/shared/Button';
import EntityBanner from '@/components/shared/EntityBanner';
import ActivityTimeline from '@/components/shared/ActivityTimeline';
import { DataTable, DataTableColumn } from '@/components/shared/DataTable';
import EmailDocumentDialog from '@/components/shared/EmailDocumentDialog';

import * as api from '@herobm/sdk';
import { getErrorMessage, RETURN_STATE, RETURN_TRANSITIONS, DATA_SOURCE_CONTEXT, computeReturnCreditSummary, computeLinePrice, isBackTransition, RETURN_LIFECYCLE, PUTAWAY_STATUS, RETURN_RESOLUTION } from '@herobm/shared';
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
  
  const { ret, locations, loading, error, fetchReturn } = useSalesReturn(id as string);
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
      render: (_, i) => <span className="text-[var(--text-muted)]">{i + 1}</span>,
    },
    {
      id: 'product',
      header: t('columns.product'),
      width: 150,
      render: (line) =>
        line.productId ? (
          <Link href={`/products/${line.productId}`} className="font-semibold hover:underline text-[var(--accent)]">
            {line.productNumber || '—'}
          </Link>
        ) : (
          <span className="font-semibold">{line.productNumber || '—'}</span>
        ),
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
      render: (line) => <span className="tabular-nums">{parseFloat(line.quantityReturned)}</span>,
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
      id: 'status',
      header: 'Putaway Status',
      width: 120,
      render: (line) => {
          if (line.putawayStatus === PUTAWAY_STATUS.QUARANTINED) {
              return <span className="badge badge-warning text-[10px]">Quarantined</span>;
          }
          if (line.putawayStatus === PUTAWAY_STATUS.PENDING_PUTAWAY) {
              return <span className="badge badge-neutral text-[10px]">Pending</span>;
          }
          if (line.putawayStatus === PUTAWAY_STATUS.COMPLETED) {
              return <span className="badge badge-success text-[10px]">Putaway</span>;
          }
          return <span className="badge badge-ghost text-[10px]">{line.putawayStatus || '—'}</span>;
      }
    },
    {
      id: 'fee',
      header: t('columns.fee'),
      width: 110,
      align: 'right',
      render: (line) => (
        <span className="font-semibold tabular-nums">
          {parseFloat(line.returnFee || '0') > 0 ? formatAmount(parseFloat(line.returnFee || '0'), ret.currencyCode) : '—'}
        </span>
      ),
    },
    {
      id: 'amount',
      header: t('columns.amount'),
      width: 130,
      align: 'right',
      render: (line) => {
        const qty = parseFloat(line.quantityReturned || '0');
        const price = parseFloat(line.pricePerUnit || '0');
        const disc = parseFloat(line.discountPercentage || '0');
        const isRefund = line.resolution === RETURN_RESOLUTION.REFUND;
        const lineAmount = isRefund
          ? computeLinePrice({
              quantity: qty,
              pricePerUnit: price,
              discountPercentage: disc,
              taxRate: parseFloat(line.taxRate || '0'),
            }).amount
          : 0;
        return (
          <span className="font-semibold tabular-nums">
            {formatAmount(lineAmount, ret.currencyCode)}
          </span>
        );
      },
    }
  ];

  const creditSummary = computeReturnCreditSummary(
    ret.lines.map((l) => ({
      quantity: parseFloat(l.quantityReturned || '0'),
      pricePerUnit: parseFloat(l.pricePerUnit || '0'),
      discountPercentage: parseFloat(l.discountPercentage || '0'),
      taxRate: parseFloat(l.taxRate || '0'),
      returnFee: parseFloat(l.returnFee || '0'),
      resolution: l.resolution,
    })),
  );

  const linesFooter = (
    <>
      <tr className="hidden lg:table-row border-t-2 border-[var(--border)]">
        <td colSpan={8} className="text-right font-semibold text-xs text-[var(--text-muted)]">
          {tCommon('subtotal')}
        </td>
        <td className="text-right tabular-nums font-semibold">
          {formatAmount(creditSummary.subtotal, ret.currencyCode)}
        </td>
      </tr>
      <tr className="hidden lg:table-row">
        <td colSpan={8} className="text-right font-semibold text-xs text-[var(--text-muted)]">
          Total Tax
        </td>
        <td className="text-right tabular-nums font-semibold">
          {formatAmount(creditSummary.totalTax, ret.currencyCode)}
        </td>
      </tr>
      {creditSummary.totalFees > 0 && (
        <tr className="hidden lg:table-row">
          <td colSpan={8} className="text-right font-semibold text-xs text-[var(--text-muted)]">
            Total Fees
          </td>
          <td className="text-right tabular-nums font-semibold text-[var(--text-danger)]">
            -{formatAmount(creditSummary.totalFees, ret.currencyCode)}
          </td>
        </tr>
      )}
      <tr className="hidden lg:table-row">
        <td colSpan={8} className="text-right font-semibold text-[13px] text-[var(--text-primary)]">
          {t('returns.netCredit')}
        </td>
        <td className="text-right tabular-nums font-bold text-[14px]">
          {formatAmount(creditSummary.netCredit, ret.currencyCode)}
          {creditSummary.netCredit === 0 && ret.lines.some(l => l.resolution === RETURN_RESOLUTION.REPLACE) && (
            <div className="text-[10px] font-normal text-[var(--text-muted)] mt-0.5">(Replacement)</div>
          )}
        </td>
      </tr>
    </>
  );

  const isEditable = ret && ret.stateCode !== RETURN_STATE.RECEIVED && ret.stateCode !== RETURN_STATE.PROCESSED && ret.stateCode !== RETURN_STATE.CANCELLED;

  const hasPendingPutaway = ret.lines.some(l => l.putawayStatus === PUTAWAY_STATUS.PENDING_PUTAWAY || l.putawayStatus === PUTAWAY_STATUS.AWAITING_MATCHING);
  const hasQuarantined = ret.lines.some(l => l.putawayStatus === PUTAWAY_STATUS.QUARANTINED);

  const quarantineTitle = hasQuarantined ? 'Items Quarantined' : 'Pending Inspection';
  const quarantineDesc = hasQuarantined 
      ? 'Some returned items have been quarantined during putaway. Please review before issuing a credit note.'
      : 'Returned items have not been fully put away and inspected yet. Proceed with caution when issuing a credit note.';

  return (
    <DetailsLayout
      header={
        <EntityHeader
          title={ret.returnNumber}
          subtitle={`Order: ${ret.orderNumber || ret.salesOrderNumber || ''}`}
          actions={
            <div className="flex gap-2">
                {[...allowedRetTransitions]
                    .sort((a, b) => {
                        const aBack = isBackTransition(RETURN_LIFECYCLE, ret.stateCode, a);
                        const bBack = isBackTransition(RETURN_LIFECYCLE, ret.stateCode, b);
                        if (aBack !== bBack) return aBack ? -1 : 1;
                        return 0;
                    })
                    .map((s: string) => {
                        const back = isBackTransition(RETURN_LIFECYCLE, ret.stateCode, s);
                        return (
                            <Button
                                key={s}
                                disabled={saving}
                                variant={s === RETURN_STATE.CANCELLED ? 'danger' : back ? 'secondary' : 'primary'}
                                size="sm"
                                onClick={() => handleStateChange(s)}
                            >
                                {s === RETURN_STATE.CANCELLED ? (
                                    <>

                                        <span className="material-symbols-outlined mr-1 text-[16px]">close</span>
                                        {tCommon('cancel')}
                                    </>
                                ) : back ? (
                                    <>← <StateName state={s as ValidState} /></>
                                ) : (
                                    <>→ <StateName state={s as ValidState} /></>
                                )}
                            </Button>
                        );
                    })}
                {ret.stateCode === RETURN_STATE.RECEIVED && (
                    <Button
                        variant="primary"
                        size="sm"
                        disabled={saving}
                        onClick={handleProcessReturn}
                    >
                        Process Return
                    </Button>
                )}
            </div>
          }
          badges={<PurchaseReturnStateBadge state={ret.stateCode as ValidState} />}
        />
      }
    >
      <div className="flex flex-col gap-3">
        {(hasPendingPutaway || hasQuarantined) && ret.stateCode !== RETURN_STATE.PROCESSED && ret.stateCode !== RETURN_STATE.CANCELLED && (
          <EntityBanner 
            type="warning" 
            title={quarantineTitle} 
            description={quarantineDesc} 
          />
        )}

        {/* Details Card */}
        <div id="details-section" className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="section-heading flex items-center gap-2">
              <span className="material-symbols-outlined shrink-0">info</span>
              <span>{t('returns.returnDetails')}</span>
            </h3>
            {ret.stateCode !== RETURN_STATE.CANCELLED && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setEmailDialogConfig({
                  isOpen: true,
                  hookSlug: 'return-slip',
                  title: 'Email Return Slip',
                  prefix: 'Return Slip',
                  docName: 'Return Slip',
                  targetId: ret.returnId,
                  contextSlug: DATA_SOURCE_CONTEXT.SALES_RETURN
                })}
              >
                Email Return Slip
              </Button>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-medium mb-1 text-[var(--text-muted)]">
                {t('returns.customer')}
              </label>
              <div className="text-sm">
                {ret.customerId ? (
                  <Link href={`/customers/${ret.customerId}`} className="text-[var(--accent)] hover:underline font-medium">
                    {ret.customerName}
                  </Link>
                ) : (
                  ret.customerName || '—'
                )}
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1 text-[var(--text-muted)]">
                {t('returns.orderNo')}
              </label>
              <div className="text-sm">
                {ret.salesOrderId ? (
                  <Link href={`/sales-orders/${ret.salesOrderId}`} className="text-[var(--accent)] hover:underline font-medium">
                    {ret.orderNumber || ret.salesOrderNumber || '—'}
                  </Link>
                ) : (
                  ret.orderNumber || ret.salesOrderNumber || '—'
                )}
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1 text-[var(--text-muted)]">
                {t('returns.date')}
              </label>
              <div className="text-sm">
                {formatLocalDate(ret.createdOn)}
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1 text-[var(--text-muted)]">
                {t('returns.returnLocation')}
              </label>
              <div className="text-sm">
                {isEditable ? (
                  <select
                    className="input text-sm"
                    value={ret.locationId || ''}
                    onChange={async (e) => {
                      try {
                        setSaving(true);
                        await api.orderReturnsControllerUpdateReturn(ret.salesOrderId, ret.returnId, { locationId: e.target.value });
                        await fetchReturn();
                      } catch (err) {
                        alert(getErrorMessage(err));
                      } finally {
                        setSaving(false);
                      }
                    }}
                    disabled={saving}
                  >
                    <option value="">{tCommon('select')}</option>
                    {(locations || []).map((loc) => (
                      <option key={loc.locationId} value={loc.locationId}>
                        {formatLocationDisplay(loc)}
                      </option>
                    ))}
                  </select>
                ) : (
                  ret.locationName || '—'
                )}
              </div>
            </div>
          </div>
          {(isEditable || ret.notes) && (
            <div className="mt-6">
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Notes</div>
              {isEditable ? (
                <textarea
                  className="input text-sm w-full"
                  defaultValue={ret.notes || ''}
                  rows={3}
                  onBlur={async (e) => {
                    if (e.target.value !== ret.notes) {
                      try {
                        setSaving(true);
                        await api.orderReturnsControllerUpdateReturn(ret.salesOrderId, ret.returnId, { notes: e.target.value });
                        await fetchReturn();
                      } catch (err) {
                        alert(getErrorMessage(err));
                      } finally {
                        setSaving(false);
                      }
                    }
                  }}
                  disabled={saving}
                />
              ) : (
                <div className="text-sm font-medium whitespace-pre-wrap">{ret.notes}</div>
              )}
            </div>
          )}
        </div>

        {/* Lines */}
        <div id="lines-section" className="card">
          <h3 className="section-heading mb-4 flex items-center gap-2">
            {/* eslint-disable-next-line i18next/no-literal-string -- Material UI Icon */}
            <span className="material-symbols-outlined shrink-0">list</span>
            <span>{t('lineItems')}</span>
          </h3>
          <DataTable
            data={ret.lines || []}
            columns={lineColumns}
            keyExtractor={(line) => line.returnLineId}
            emptyMessage={t('noLineItems')}
            footer={linesFooter}
          />
        </div>

        {/* Linked Credit Notes Section */}
        {((ret.creditNotes && ret.creditNotes.length > 0) || ret.creditNoteNumber) && (
          <div id="credit-notes-section" className="card">
            <h3 className="section-heading mb-3 flex items-center gap-2">
              <span className="material-symbols-outlined shrink-0">receipt_long</span>
              <span>Credit Notes</span>
            </h3>
            <div className="flex flex-col gap-2">
              {(ret.creditNotes && ret.creditNotes.length > 0
                ? ret.creditNotes
                : [{ creditNoteNumber: ret.creditNoteNumber }]
              ).map((cn, idx) => (
                <div key={cn.creditNoteId || idx} className="p-3 rounded-lg border border-[var(--border)] flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-[var(--accent)] text-lg">receipt_long</span>
                    <div>
                      <div className="font-semibold text-sm text-[var(--text-primary)]">{cn.creditNoteNumber}</div>
                      {cn.createdOn && (
                        <div className="text-xs text-[var(--text-muted)]">{formatLocalDate(cn.createdOn)}</div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {(() => {
                      const cnTotal =
                        parseFloat(cn.totalAmount || '0') +
                        parseFloat(cn.taxAmount || '0') -
                        parseFloat(cn.feeAmount || '0');
                      const displayAmount = cnTotal > 0 ? cnTotal : parseFloat(cn.totalAmount || '0');
                      return displayAmount > 0 ? (
                        <span className="font-semibold text-sm tabular-nums">
                          {formatAmount(displayAmount, ret.currencyCode || 'USD')}
                        </span>
                      ) : null;
                    })()}
                    {cn.stateCode && <StateBadge state={cn.stateCode as ValidState} />}
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setEmailDialogConfig({
                        isOpen: true,
                        hookSlug: 'sales-return-credit',
                        title: 'Email Credit Note',
                        prefix: 'Credit Note',
                        docName: 'Credit Note',
                        targetId: ret.returnId,
                        contextSlug: DATA_SOURCE_CONTEXT.SALES_RETURN
                      })}
                    >
                      Email Credit Note
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Activity Timeline */}
        <div className="card mt-4">
          <ActivityTimeline events={ret.events || []} />
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

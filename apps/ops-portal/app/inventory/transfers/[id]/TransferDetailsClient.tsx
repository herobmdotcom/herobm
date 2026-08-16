'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import EntityHeader from '@/components/shared/EntityHeader';
import DetailsLayout from '@/components/shared/DetailsLayout';
import StateBadge from '@/components/StateBadge';
import ActivityTimeline, { TimelineEvent } from '@/components/shared/ActivityTimeline';
import { ValidState } from '@/types/states';
import { useTransferOrder } from './useTransferOrder';
import { TRANSFER_ORDER_STATE } from '@herobm/shared';
import { TransferLineResponseDto } from '@herobm/sdk';
import ProductSearchInput, { Product } from '@/components/shared/ProductSearchInput';
import { MobileCardField } from '@/components/shared/DataTable';
import ShipmentsSection from './ShipmentsSection';
import { Button } from '@/components/shared/Button';

export default function TransferDetailsClient({ id }: { id: string }) {
  const router = useRouter();
  const tCommon = useTranslations('common');
  const tTransfers = useTranslations('transfers');

  const {
    order,
    loading,
    error,
    saving,
    clearError,
    editNotes,
    setEditNotes,
    editShippingNotes,
    setEditShippingNotes,
    saveHeader,
    addLine,
    updateLine,
    removeLine,
    shipOrder,
    cancelOrder,
  } = useTransferOrder(id);

  useDocumentTitle(order ? tTransfers('transferTitle', { number: order.orderNumber }) : null);

  if (loading) {
    return (
      <div className="flex items-center justify-center flex-1">
        <p className="text-[var(--text-muted)]">{tCommon('loading')}</p>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="flex flex-col items-center justify-center flex-1">
        <p className="text-lg mb-2 text-[var(--danger)]">
          {error || tTransfers('notFound')}
        </p>
        <Button variant="secondary" onClick={() => router.push('/inventory/transfers')}>
          {tTransfers('backToTransfers')}
        </Button>
      </div>
    );
  }

  const isEditable = order.stateCode === TRANSFER_ORDER_STATE.CONFIRMED;
  const canCancelOrder = ([
    TRANSFER_ORDER_STATE.CONFIRMED,
    TRANSFER_ORDER_STATE.PICKING,
  ] as string[]).includes(order.stateCode);
  const headerDirty = order.notes !== editNotes;

  const handleCancelOrder = async () => {
    if (window.confirm(tTransfers('cancelConfirm'))) {
      await cancelOrder();
    }
  };

  return (
    <DetailsLayout
      header={
        <EntityHeader
          title={order.orderNumber}
          subtitle={tTransfers('subtitleFlow', {
            source: order.sourceLocationName || order.sourceLocationId || '',
            destination: order.destinationLocationName || order.destinationLocationId || ''
          })}
          isSaving={saving}
          badges={<StateBadge state={order.stateCode as ValidState} />}
          actions={
            <div className="flex gap-2">
              {canCancelOrder && (
                <Button
                  variant="danger"
                  size="sm"
                  onClick={handleCancelOrder}
                  disabled={saving}
                >
                  {tCommon('cancel')}
                </Button>
              )}
            </div>
          }
        />
      }
    >
      <div className="flex flex-col gap-3">
        {error && (
          <div className="px-4 py-3 rounded-lg text-sm bg-red-500/10 border border-red-500/30 text-red-400">
            {error}
            <Button variant="ghost" className="ml-3 text-xs underline" onClick={clearError}>{tCommon('dismiss')}</Button>
          </div>
        )}

        <div className="card">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
                {tTransfers('columns.sourceLocation')}
              </label>
              <p className="text-sm font-medium pt-1.5">
                {order.sourceLocationName || order.sourceLocationId}
              </p>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
                {tTransfers('columns.destinationLocation')}
              </label>
              <p className="text-sm font-medium pt-1.5">
                {order.destinationLocationName || order.destinationLocationId}
              </p>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
                {tTransfers('columns.createdOn')}
              </label>
              <p className="text-sm font-medium pt-1.5">
                {new Date(order.createdOn).toLocaleString()} {tCommon('by')} {order.createdBy}
              </p>
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
                {tTransfers('columns.notes')}
              </label>
              <input
                className="input w-full"
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                onBlur={saveHeader}
                placeholder={tTransfers('placeholders.notes')}
              />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
                {tTransfers('columns.shippingNotes')}
              </label>
              <input
                className="input w-full"
                value={editShippingNotes}
                onChange={(e) => setEditShippingNotes(e.target.value)}
                onBlur={saveHeader}
                placeholder={tTransfers('placeholders.shippingNotes')}
              />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="section-heading">
              { }
              <span className="material-symbols-outlined">inventory_2</span>
              {tTransfers('lineItems')}
            </h3>
            {isEditable && (
              <ProductSearchInput
                onSelect={(p: Product) => addLine(p.productId, 1)}
                placeholder={tTransfers('placeholders.searchProduct')}
                className="w-[240px]"
              />
            )}
          </div>

          <div className="hidden lg:block overflow-x-auto w-full">
            <table className="table-lines">
            <thead>
              <tr>
                <th>{tTransfers('columns.product')}</th>
                <th>{tTransfers('columns.description')}</th>
                <th className="w-[120px] text-right">{tTransfers('columns.ordered')}</th>
                <th className="w-[120px] text-right">{tTransfers('columns.shipped')}</th>
                <th className="w-[120px] text-right">{tTransfers('columns.received')}</th>
                {isEditable && <th className="w-[50px]"></th>}
              </tr>
            </thead>
            <tbody>
              {order.lines?.map((line: TransferLineResponseDto) => (
                <tr key={line.transferOrderLineId}>
                  <td className="font-semibold text-xs">
                    {line.productNumber || '—'}
                  </td>
                  <td>{line.productDescription || '—'}</td>
                  {isEditable ? (
                    <td className="text-right">
                      <input
                        className="input w-full text-right"
                        type="number"
                        min="1"
                        step="1"
                        defaultValue={line.quantity}
                        onBlur={(e) => {
                          const val = parseFloat(e.target.value);
                          if (val > 0 && val !== parseFloat(line.quantity)) {
                            updateLine(line.transferOrderLineId, val);
                          }
                        }}
                      />
                    </td>
                  ) : (
                    <td className="text-right tabular-nums">
                      {line.quantity}
                    </td>
                  )}
                  <td className="text-right tabular-nums">
                    {line.quantityShipped || 0}
                  </td>
                  <td className="text-right tabular-nums">
                    {line.quantityReceived || 0}
                  </td>
                  {isEditable && (
                    <td>
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => removeLine(line.transferOrderLineId)}
                        title={tTransfers('removeLine')}
                      >
                        <span dangerouslySetInnerHTML={{ __html: '&#10005;' }} />
                      </Button>
                    </td>
                  )}
                </tr>
              ))}
              {(!order.lines || order.lines.length === 0) && (
                <tr>
                  <td
                    colSpan={isEditable ? 6 : 5}
                    className="text-center text-[var(--text-muted)] py-5"
                  >
                    {tTransfers('noLineItems')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          </div>
          <div className="lg:hidden flex flex-col gap-3 w-full">
            {order.lines?.map((line: TransferLineResponseDto, idx: number) => (
              <div key={line.transferOrderLineId} className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] p-4 flex flex-col">
                <div className="flex justify-between items-start gap-2 mb-2">
                  <div className="font-semibold text-sm text-[var(--accent)]">
                    {line.productNumber || '—'}
                  </div>
                  <div className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded font-medium">#{idx + 1}</div>
                </div>
                <div className="text-sm text-slate-600 font-medium mb-3">
                  {line.productDescription || '—'}
                </div>
                <div className="flex flex-col gap-1 border-t border-slate-100 pt-2">
                  <MobileCardField label={tTransfers('columns.ordered')} value={
                    isEditable ? (
                      <input
                        className="input w-[100px] text-right py-1 px-2 h-[32px]"
                        type="number"
                        min="1"
                        step="1"
                        defaultValue={line.quantity}
                        onBlur={(e) => {
                          const val = parseFloat(e.target.value);
                          if (val > 0 && val !== parseFloat(line.quantity)) {
                            updateLine(line.transferOrderLineId, val);
                          }
                        }}
                      />
                    ) : line.quantity
                  } />
                  <MobileCardField label={tTransfers('columns.shipped')} value={line.quantityShipped || 0} />
                  <MobileCardField label={tTransfers('columns.received')} value={line.quantityReceived || 0} />
                  {isEditable && (
                    <div className="flex justify-end pt-2 mt-1 border-t border-slate-50">
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => removeLine(line.transferOrderLineId)}
                        title={tTransfers('removeLine')}
                      >
                        <span dangerouslySetInnerHTML={{ __html: '&#10005;' }} /> {tCommon('delete')}
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {(!order.lines || order.lines.length === 0) && (
              <div className="text-center py-6 text-slate-400 text-sm">
                {tTransfers('noLineItems')}
              </div>
            )}
          </div>
        </div>

        {/* Shipments Section */}
        <ShipmentsSection orderId={id} />

        {/* Activity Timeline */}
        <div className="card">
          <ActivityTimeline events={(order.events || []) as unknown as TimelineEvent[]} />
        </div>
      </div>
    </DetailsLayout>
  );
}

'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import EntityHeader from '@/components/shared/EntityHeader';
import DetailsLayout from '@/components/shared/DetailsLayout';
import StateBadge from '@/components/StateBadge';
import ActivityTimeline from '@/components/shared/ActivityTimeline';
import { ValidState } from '@/types/states';
import { useTransferOrder } from './useTransferOrder';
import { TRANSFER_ORDER_STATE } from '@modbm/shared';
import ProductSearchInput from '@/components/shared/ProductSearchInput';

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
        <p style={{ color: 'var(--text-muted)' }}>{tCommon('loading')}</p>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="flex flex-col items-center justify-center flex-1">
        <p className="text-lg mb-2" style={{ color: 'var(--danger)' }}>
          {error || tTransfers('notFound')}
        </p>
        <button className="btn btn-secondary" onClick={() => router.push('/inventory/transfers')}>
          {tTransfers('backToTransfers')}
        </button>
      </div>
    );
  }

  const isEditable = order.stateCode === TRANSFER_ORDER_STATE.CONFIRMED;
  const canCancel = [
    TRANSFER_ORDER_STATE.CONFIRMED,
    TRANSFER_ORDER_STATE.PICKING,
    TRANSFER_ORDER_STATE.SHIPPED,
  ].includes(order.stateCode );
  const headerDirty = order.notes !== editNotes;

  const handleCancel = async () => {
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
          onBack={() => router.push('/inventory/transfers')}
          isSaving={saving}
          badges={<StateBadge state={order.stateCode as ValidState} />}
          actions={
            <div className="flex gap-2">
              {canCancel && (
                <button
                  className="btn btn-danger btn-sm"
                  onClick={handleCancel}
                  disabled={saving}
                >
                  {/* eslint-disable-next-line i18next/no-literal-string */}
                  <span className="material-symbols-outlined mr-1" style={{ fontSize: 16 }}>close</span>
                  {/* eslint-enable i18next/no-literal-string */}
                  {tCommon('cancel')}
                </button>
              )}
            </div>
          }
        />
      }
    >
      <div className="flex flex-col gap-3">
        {error && (
          <div
            className="px-4 py-3 rounded-lg text-sm"
            style={{
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: '#f87171',
            }}
          >
            {error}
            <button className="ml-3 text-xs underline" onClick={clearError}>{tCommon('dismiss')}</button>
          </div>
        )}

        <div className="card">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                {tTransfers('columns.sourceLocation')}
              </label>
              <p className="text-sm" style={{ fontWeight: 500, paddingTop: 6 }}>
                {order.sourceLocationName || order.sourceLocationId}
              </p>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                {tTransfers('columns.destinationLocation')}
              </label>
              <p className="text-sm" style={{ fontWeight: 500, paddingTop: 6 }}>
                {order.destinationLocationName || order.destinationLocationId}
              </p>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                {tTransfers('columns.createdOn')}
              </label>
              <p className="text-sm" style={{ fontWeight: 500, paddingTop: 6 }}>
                {new Date(order.createdOn).toLocaleString()} {tCommon('by')} {order.createdBy}
              </p>
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                {tTransfers('columns.notes')}
              </label>
              <input
                className="input w-full"
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                onBlur={saveHeader}
                disabled={!isEditable}
                placeholder={tTransfers('placeholders.notes')}
              />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="section-heading">
              {/* eslint-disable-next-line i18next/no-literal-string */}
              <span className="material-symbols-outlined">inventory_2</span>
              {/* eslint-enable i18next/no-literal-string */}
              {tTransfers('lineItems')}
            </h3>
            {isEditable && (
              <ProductSearchInput
                onSelect={(p: any) => addLine(p.productId, 1)}
                placeholder={tTransfers('placeholders.searchProduct')}
                style={{ width: 240 }}
              />
            )}
          </div>

          <table className="table-lines">
            <thead>
              <tr>
                <th>{tTransfers('columns.product')}</th>
                <th>{tTransfers('columns.description')}</th>
                <th style={{ width: 120, textAlign: 'right' }}>{tTransfers('columns.ordered')}</th>
                <th style={{ width: 120, textAlign: 'right' }}>{tTransfers('columns.shipped')}</th>
                <th style={{ width: 120, textAlign: 'right' }}>{tTransfers('columns.received')}</th>
                {isEditable && <th style={{ width: 50 }}></th>}
              </tr>
            </thead>
            <tbody>
              {order.lines?.map((line: any) => (
                <tr key={line.transferOrderLineId}>
                  <td style={{ fontWeight: 600, fontSize: 12 }}>
                    {line.productNumber || '—'}
                  </td>
                  <td>{line.productDescription || '—'}</td>
                  {isEditable ? (
                    <td style={{ textAlign: 'right' }}>
                      <input
                        className="input"
                        type="number"
                        min="1"
                        step="1"
                        style={{ width: '100%', textAlign: 'right' }}
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
                    <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                      {line.quantity}
                    </td>
                  )}
                  <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                    {line.quantityShipped || 0}
                  </td>
                  <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                    {line.quantityReceived || 0}
                  </td>
                  {isEditable && (
                    <td>
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => removeLine(line.transferOrderLineId)}
                        title={tTransfers('removeLine')}
                      >
                        <span dangerouslySetInnerHTML={{ __html: '&#10005;' }} />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
              {(!order.lines || order.lines.length === 0) && (
                <tr>
                  <td
                    colSpan={isEditable ? 6 : 5}
                    style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '20px 0' }}
                  >
                    {tTransfers('noLineItems')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Activity Timeline */}
        <div className="card">
          <ActivityTimeline events={order.events || []} />
        </div>
      </div>
    </DetailsLayout>
  );
}

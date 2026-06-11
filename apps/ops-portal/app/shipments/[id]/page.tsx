'use client';

import { use, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { reportError } from '@/lib/api';
import * as api from '@modbm/sdk';
import StateBadge, { StateName } from '@/components/StateBadge';
import { ValidState } from '@/types/states';
import EntityHeader from '@/components/shared/EntityHeader';
import DetailsLayout from '@/components/shared/DetailsLayout';
import ActivityTimeline, { TimelineEvent } from '@/components/shared/ActivityTimeline';
import Link from 'next/link';
import { toast } from 'react-hot-toast';
import { SHIPMENT_STATE } from '@modbm/shared';
import MobileLineItemCard from '@/components/shared/MobileLineItemCard';
import { getErrorMessage } from '@modbm/shared';

interface ShipmentLine {
  shipmentLineId: string;
  salesOrderLineId: string;
  quantityShipped: string;
  productId: string;
  productNumber: string;
  productDescription: string;
  orderNumber: string;
}

interface ShipmentDetail {
  shipmentId: string;
  shipmentNumber: string;
  salesOrderId: string;
  orderNumber: string;
  customerId: string;
  customerName: string;
  stateCode: string;
  notes: string | null;
  trackingNumber: string | null;
  createdOn: string;
  createdBy: string | null;
  lines: ShipmentLine[];
  events: TimelineEvent[];
}

export default function ShipmentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const t = useTranslations('shipments');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const [shipment, setShipment] = useState<ShipmentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [isCancelling, setIsCancelling] = useState(false);

  const loadShipment = () => {
    setLoading(true);
    (api.globalShipmentsControllerFindOne(id) )
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .then((res: any) => {
        setShipment(res.data ? res.data : res);
        setLoading(false);
      })
      .catch((err: unknown) => {
        reportError(err, 'ShipmentDetailPage.loadShipment');
        setLoading(false);
      });
  };

  useEffect(() => {
    loadShipment();
  }, [id]);

  const handleCancel = async () => {
    if (!shipment) return;
    if (!window.confirm(t('confirmCancel'))) return;

    setIsCancelling(true);
    try {
      await api.orderShipmentsControllerCancelShipment(shipment.salesOrderId, shipment.shipmentId, { body: JSON.stringify({}) });
      loadShipment();
    } catch (err: unknown) {
      reportError(err, 'ShipmentDetailPage.handleCancel');
      alert(getErrorMessage(err) || t('cancelFailed'));
    } finally {
      setIsCancelling(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center flex-1">
        <p style={{ color: 'var(--text-muted)' }}>{tCommon('loading')}</p>
      </div>
    );
  }

  if (!shipment) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-[var(--text-muted)]">
        <p className="mb-4">{t('notFound')}</p>
        <button className="btn btn-primary" onClick={() => router.push('/shipments')}>
          {t('backToShipments')}
        </button>
      </div>
    );
  }

  return (
    <DetailsLayout
      header={
        <EntityHeader
          title={shipment.shipmentNumber}
          subtitle={`${t('shipmentDetails')} • ${new Date(shipment.createdOn).toLocaleDateString()}`}
          onBack={() => router.push('/shipments')}
          badges={<StateBadge state={shipment.stateCode as ValidState} />}
          actions={
            shipment.stateCode === SHIPMENT_STATE.DISPATCHED && (
              <button
                className="btn btn-danger btn-sm"
                onClick={handleCancel}
                disabled={isCancelling}
              >
                {isCancelling ? (
                  tCommon('resolving')
                ) : (
                  <>
                    {/* eslint-disable-next-line i18next/no-literal-string */}
                    <span className="material-symbols-outlined mr-1" style={{ fontSize: 16 }}>close</span>
                    {tCommon('cancel')}
                  </>
                )}
              </button>
            )
          }
        />
      }
    >
      <div className="flex flex-col gap-3">
        {/* Shipment Details Card */}
        <div id="details-section" className="card">
          <div className="flex items-center justify-between mb-4 gap-4">
            <h3 className="section-heading flex items-center gap-2 truncate">
              {/* eslint-disable-next-line i18next/no-literal-string */}
              <span className="material-symbols-outlined shrink-0">local_shipping</span>
              <span className="truncate">{t('shipmentDetails')}</span>
            </h3>
            <button
              className="btn btn-secondary btn-sm flex items-center shrink-0"
              onClick={async () => {
                try {
                  const api = await import('@modbm/sdk');
                  const res = await api.pdfTemplatesControllerRunHook('shipping-docket', {}, { id, context: 'shipment' });
                  const blob = res.data as Blob;
                  const url = URL.createObjectURL(blob);
                  window.open(url, '_blank');
                } catch (err) {
                  reportError(err, 'ShipmentDetailPage.generateDocket');
                  toast.error('Failed to generate shipping docket.');
                }
              }}
            >
              {t('docketPdf')}
            </button>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                {t('columns.customer')}
              </label>
              <p className="text-sm" style={{ fontWeight: 500, paddingTop: 6 }}>
                {shipment.customerName || '—'}
              </p>
            </div>
            
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                {t('columns.tracking')}
              </label>
              <p className="text-sm" style={{ fontWeight: 500, paddingTop: 6 }}>
                {shipment.trackingNumber || '—'}
              </p>
            </div>

            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                {t('columns.date')}
              </label>
              <p className="text-sm" style={{ fontWeight: 500, paddingTop: 6 }}>
                {new Date(shipment.createdOn).toLocaleString()} {tCommon('by')} {shipment.createdBy || tCommon('system')}
              </p>
            </div>

            <div className="col-span-2">
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                {tCommon('notesCardHeading')}
              </label>
              <p className="text-sm" style={{ fontWeight: 500, paddingTop: 6 }}>
                {shipment.notes || '—'}
              </p>
            </div>
          </div>
        </div>

        {/* Line Items Card */}
        <div id="lines-section" className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="section-heading flex items-center gap-2">
              {/* eslint-disable-next-line i18next/no-literal-string */}
              <span className="material-symbols-outlined shrink-0">list_alt</span>
              <span>{t('lineItems')}</span>
            </h3>
          </div>
          
          {/* Desktop Table */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="table-lines min-w-[500px]">
              <thead>
                <tr>
                <th style={{ width: 120 }}>{t('columns.orderNumber')}</th>
                <th>{t('columns.product')}</th>
                <th>{t('columns.description')}</th>
                <th style={{ width: 90, textAlign: 'right' }}>{t('columns.qty')}</th>
              </tr>
            </thead>
            <tbody>
              {shipment.lines.map((line) => (
                <tr key={line.shipmentLineId}>
                  <td style={{ color: 'var(--text-muted)', fontWeight: 400 }}>
                    {line.orderNumber}
                  </td>
                  <td style={{ fontWeight: 600, fontSize: 12 }}>
                    <Link href={`/products/${line.productId}`} style={{ color: 'var(--accent)', textDecoration: 'none' }}>
                      {line.productNumber || '—'}
                    </Link>
                  </td>
                  <td>{line.productDescription || '—'}</td>
                  <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                    {line.quantityShipped}
                  </td>
                </tr>
              ))}
              {shipment.lines.length === 0 && (
                <tr>
                  <td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '20px 0' }}>
                    {tCommon('orderReadView.noLineItems')}
                  </td>
                </tr>
              )}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="flex flex-col lg:hidden mt-2">
            {shipment.lines.map((line, idx) => (
              <MobileLineItemCard
                key={line.shipmentLineId}
                title={
                  <Link href={`/products/${line.productId}`} className="text-[var(--accent)] hover:underline">
                    {line.productNumber || '—'}
                  </Link>
                }
                subtitle={line.productDescription || '—'}
                topRightBadge={`#${idx + 1}`}
                details={[
                  {
                    label: t('columns.qty'),
                    value: line.quantityShipped
                  },
                  {
                    label: t('columns.orderNumber'),
                    value: <span className="font-semibold text-[var(--text-secondary)]">{line.orderNumber}</span>
                  }
                ]}
              />
            ))}
            {shipment.lines.length === 0 && (
              <div className="text-center text-sm text-[var(--text-muted)] py-4 border border-[var(--border)] rounded-lg">
                {tCommon('orderReadView.noLineItems')}
              </div>
            )}
          </div>
        </div>

        {/* Activity Timeline Card */}
        <div id="activity-section" className="card">
          <ActivityTimeline events={shipment.events} />
        </div>
      </div>
    </DetailsLayout>
  );
}

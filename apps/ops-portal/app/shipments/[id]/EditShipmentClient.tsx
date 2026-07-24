'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/shared/Button';
import { useRouter } from 'next/navigation';
import { reportError } from '@/lib/api';
import * as api from '@herobm/sdk';
import StateBadge, { StateName } from '@/components/StateBadge';
import { ValidState } from '@/types/states';
import EntityHeader from '@/components/shared/EntityHeader';
import DetailsLayout from '@/components/shared/DetailsLayout';
import PageNav from '@/components/shared/PageNav';
import ActivityTimeline, { TimelineEvent } from '@/components/shared/ActivityTimeline';
import Link from 'next/link';
import { toast } from 'react-hot-toast';
import { SHIPMENT_STATE } from '@herobm/shared';
import MobileLineItemCard from '@/components/shared/MobileLineItemCard';
import { getErrorMessage } from '@herobm/shared';
import AddressDisplay from '@/components/shared/AddressDisplay';
import { DataTable } from '@/components/shared/DataTable';

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
  deliveryName?: string;
  deliveryCompanyName?: string | null;
  deliveryPhone?: string;
  deliveryAddressLine1?: string;
  deliveryAddressLine2?: string;
  deliveryCity?: string;
  deliveryState?: string;
  deliveryPostalCode?: string;
  deliveryCountry?: string;
  shippingNotes?: string;
}

export default function EditShipmentClient({ id }: { id: string }) {
  const t = useTranslations('shipments');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const [shipment, setShipment] = useState<ShipmentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [isCancelling, setIsCancelling] = useState(false);

  const loadShipment = () => {
    setLoading(true);
    (api.globalShipmentsControllerFindOne(id) )
      .then((res) => {
        setShipment(res.data ? (res.data as unknown as ShipmentDetail) : (res as unknown as ShipmentDetail));
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
      if (shipment.shipmentNumber?.startsWith('TSH-')) {
        await api.transfersControllerCancelTransferOrderShipment(shipment.salesOrderId, { body: JSON.stringify({}) });
      } else {
        await api.orderShipmentsControllerCancelShipment(shipment.salesOrderId, shipment.shipmentId, { body: JSON.stringify({}) });
      }
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
        <Button variant="primary" onClick={() => router.push('/shipments')}>
          {t('backToShipments')}
        </Button>
      </div>
    );
  }

  return (
    <DetailsLayout
      header={
        <EntityHeader
          title={shipment.shipmentNumber}
          subtitle={`${t('shipmentDetails')} • ${new Date(shipment.createdOn).toLocaleDateString()}`}
          badges={<StateBadge state={shipment.stateCode as ValidState} />}
          actions={
            shipment.stateCode === SHIPMENT_STATE.DISPATCHED && (
              <Button
                variant="danger"
                size="sm"
                onClick={handleCancel}
                disabled={isCancelling}
              >
                {isCancelling ? (
                  tCommon('resolving')
                ) : (
                  <>
                    {/* eslint-disable-next-line i18next/no-literal-string -- Material icon text */}
                    <span className="material-symbols-outlined mr-1" style={{ fontSize: 16 }}>close</span>
                    {tCommon('cancel')}
                  </>
                )}
              </Button>
            )
          }
        />
      }
    >
      <div className="flex flex-col gap-3">
        <PageNav
          sections={[
            { id: 'details-section', label: 'Details' },
            { id: 'lines-section', label: 'Line Items' },
            { id: 'activity-section', label: 'Activity' },
          ]}
        />
        
        {/* Shipment Details Card */}
        <div id="details-section" className="card">
          <div className="flex items-center justify-between mb-4 gap-4">
            <h3 className="section-heading flex items-center gap-2 truncate">
              <span className="material-symbols-outlined shrink-0">local_shipping</span>
              <span className="truncate">{t('shipmentDetails')}</span>
            </h3>
            <Button
              variant="secondary"
              size="sm"
              className="flex items-center shrink-0"
              onClick={async () => {
                try {
                  const api = await import('@herobm/sdk');
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
            </Button>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                {t('columns.customer')}
              </label>
              <div className="text-sm" style={{ paddingTop: 6 }}>
                {shipment.customerName || '—'}
              </div>
            </div>
            
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                {t('columns.tracking')}
              </label>
              <p className="text-sm" style={{ paddingTop: 6 }}>
                {shipment.trackingNumber || '—'}
              </p>
            </div>

            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                {t('columns.date')}
              </label>
              <p className="text-sm" style={{ paddingTop: 6 }}>
                {new Date(shipment.createdOn).toLocaleString()} {tCommon('by')} {shipment.createdBy || tCommon('system')}
              </p>
            </div>

            <div className="col-span-2">
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                {tCommon('notesCardHeading')}
              </label>
              <p className="text-sm" style={{ paddingTop: 6 }}>
                {shipment.notes || '—'}
              </p>
            </div>
          </div>

          {(shipment.deliveryAddressLine1 || shipment.shippingNotes) && (
            <div className="flex flex-col sm:flex-row gap-4 sm:gap-6">
                {shipment.deliveryAddressLine1 && (
                    <div className="flex-1">
                        <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                            Delivery Address
                        </label>
                        <div>
                            <AddressDisplay
                                addressLine1={shipment.deliveryAddressLine1}
                                addressLine2={shipment.deliveryAddressLine2}
                                city={shipment.deliveryCity}
                                stateOrProvince={shipment.deliveryState}
                                postalCode={shipment.deliveryPostalCode}
                                country={shipment.deliveryCountry}
                                phone={shipment.deliveryPhone}
                                recipientName={shipment.deliveryName}
                                companyName={shipment.deliveryCompanyName ?? undefined}
                            />
                        </div>
                    </div>
                )}
                {shipment.shippingNotes && (
                    <div className="flex-1">
                        <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                            Shipping Instructions
                        </label>
                        <div className="mt-1 text-sm text-[var(--text-primary)] whitespace-pre-wrap">
                            {shipment.shippingNotes}
                        </div>
                    </div>
                )}
            </div>
          )}
        </div>

        {/* Line Items Card */}
        <div id="lines-section" className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="section-heading flex items-center gap-2">
              <span className="material-symbols-outlined shrink-0">list_alt</span>
              <span>{t('lineItems')}</span>
            </h3>
          </div>
          <DataTable
            data={shipment.lines}
            keyExtractor={(line) => line.shipmentLineId}
            columns={[
                { header: t('columns.orderNumber'), width: 220 },
                { header: t('columns.product'), width: 140 },
                { header: t('columns.description') },
                { header: t('columns.qty'), align: 'right', width: 90 }
            ]}
            emptyMessage={tCommon('orderReadView.noLineItems')}
            renderCustomRow={(line) => (
                <tr key={line.shipmentLineId}>
                    <td style={{ fontWeight: 500 }}>
                        <Link href={line.orderNumber?.startsWith('TO-') ? `/inventory/transfers/${shipment.salesOrderId}` : `/sales-orders/${shipment.salesOrderId}`} style={{ color: 'var(--accent)', textDecoration: 'none' }}>
                            {line.orderNumber}
                        </Link>
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
            )}
            mobileCard={(line, idx) => (
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
                    value: (
                        <Link href={line.orderNumber?.startsWith('TO-') ? `/inventory/transfers/${shipment.salesOrderId}` : `/sales-orders/${shipment.salesOrderId}`} className="font-semibold text-[var(--accent)] hover:underline">
                            {line.orderNumber}
                        </Link>
                    )
                  }
                ]}
              />
            )}
          />
        </div>

        {/* Activity Timeline Card */}
        <div id="activity-section" className="card">
          <ActivityTimeline events={shipment.events} />
        </div>
      </div>
    </DetailsLayout>
  );
}

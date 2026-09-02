'use client';

import React, { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'react-hot-toast';
import { Button } from '@/components/shared/Button';
import SlideOver from '@/components/shared/SlideOver';
import InlineAlert from '@/components/shared/InlineAlert';
import * as api from '@herobm/sdk';
import { PURCHASE_RETURN_STATE } from '@herobm/shared';
import { getErrorMessage } from '@herobm/shared';

export interface ShipReturnSlideOverProps {
  isOpen: boolean;
  onClose: () => void;
  returnRecord: {
    purchaseOrderId: string;
    returnId: string;
    orderNumber: string;
    vendorName: string;
    stateCode: string;
    notes?: string | null;
    returnNumber: string;
  };
  onRefresh: () => void;
}

export default function ShipReturnSlideOver({ isOpen, onClose, returnRecord, onRefresh }: ShipReturnSlideOverProps) {
  const tCommon = useTranslations('common');
  const tPurchase = useTranslations('purchaseOrders');
  const tShipments = useTranslations('shipments');
  
  const [loading, setLoading] = useState(false);
  const [returnDetails, setReturnDetails] = useState<api.PurchaseReturnResponseDto | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && returnRecord) {
      setLoading(true);
      setError(null);
      api.purchaseReturnsControllerFindReturn(returnRecord.purchaseOrderId, returnRecord.returnId)
        .then((res) => {
          setReturnDetails(res.data ? res.data : (res as unknown as api.PurchaseReturnResponseDto));
          setLoading(false);
        })
        .catch((err: unknown) => {
          setError(getErrorMessage(err));
          setLoading(false);
        });
    }
  }, [isOpen, returnRecord]);

  const handleStage = async () => {
    try {
      setActionLoading(true);
      await api.purchaseReturnsControllerStageReturn(returnRecord.purchaseOrderId, returnRecord.returnId, {} );
      onRefresh();
      onClose();
    } catch (err: unknown) {
      toast.error(getErrorMessage(err) || 'Failed to stage return');
    } finally {
      setActionLoading(false);
    }
  };

  const handleShip = async () => {
    try {
      setActionLoading(true);
      await api.purchaseReturnsControllerShipReturn(returnRecord.purchaseOrderId, returnRecord.returnId, {});
      onRefresh();
      onClose();
    } catch (err: unknown) {
      toast.error(getErrorMessage(err) || 'Failed to ship return');
    } finally {
      setActionLoading(false);
    }
  };

  if (!isOpen || !returnRecord) return null;

  const isDraft = returnRecord.stateCode === PURCHASE_RETURN_STATE.DRAFT;
  const isStaged = returnRecord.stateCode === PURCHASE_RETURN_STATE.STAGED;

  return (
    <SlideOver isOpen={isOpen} onClose={onClose} title={tShipments('returns.slideOverTitle', { returnNumber: returnRecord.returnNumber })}>
      <div className="flex flex-col h-full bg-[var(--bg-card)]">
        <div className="flex-1 overflow-y-auto p-6">
          
          <div className="mb-6">
            <h4 className="text-sm font-semibold mb-2">{tShipments('returns.returnDetails')}</h4>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-[var(--text-muted)] block">{tShipments('returns.poNumber')}</span>
                <strong>{returnRecord.orderNumber}</strong>
              </div>
              <div>
                <span className="text-[var(--text-muted)] block">{tShipments('returns.supplier')}</span>
                <strong>{returnRecord.vendorName}</strong>
              </div>
              <div>
                <span className="text-[var(--text-muted)] block">{tShipments('returns.status')}</span>
                <span className={`badge badge-sm ${isDraft ? 'badge-warning' : 'badge-info'}`}>
                  {returnRecord.stateCode.toUpperCase()}
                </span>
              </div>
              <div>
                <span className="text-[var(--text-muted)] block">{tShipments('returns.notes')}</span>
                {returnRecord.notes || '—'}
              </div>
            </div>
          </div>

          <div className="mb-6">
            <h4 className="text-sm font-semibold mb-2">{tShipments('returns.itemsToReturn')}</h4>
            {loading ? (
              <p className="text-sm text-[var(--text-muted)]">{tShipments('returns.loadingItems')}</p>
            ) : returnDetails?.lines ? (
              <table className="table-lines w-full">
                <thead>
                  <tr>
                    <th className="text-left">{tShipments('returns.item')}</th>
                    <th className="text-right">{tShipments('returns.qty')}</th>
                    <th className="text-left">{tShipments('returns.reason')}</th>
                  </tr>
                </thead>
                <tbody>
                  {returnDetails.lines.map((line) => (
                    <tr key={line.returnLineId}>
                      <td>{tShipments('returns.lineNum', { id: line.purchaseOrderLineId.substring(0, 8) })}</td>
                      <td className="text-right">{parseFloat(line.quantityReturned)}</td>
                      <td>{line.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : null}
          </div>

          {isDraft && (
            <div className="mb-6">
              <InlineAlert
                type="warning"
                message={
                  <div className="flex flex-col gap-1">
                    <p className="font-semibold">{tShipments('returns.stagingRequired')}</p>
                    <p>{tShipments('returns.stagingRequiredDesc', { bin: 'SUPPLIER_RETURNS' })}</p>
                  </div>
                }
              />
            </div>
          )}

          {isStaged && (
            <div className="mb-6">
              <InlineAlert
                type="info"
                message={
                  <div className="flex flex-col gap-1">
                    <p className="font-semibold">{tShipments('returns.readyToShip')}</p>
                    <p>{tShipments('returns.readyToShipDesc', { bin: 'SUPPLIER_RETURNS' })}</p>
                  </div>
                }
              />
            </div>
          )}
        </div>

        <div className="p-4 border-t border-[var(--border)] bg-[var(--bg-card)] flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose} disabled={actionLoading}>
            {tCommon('cancel')}
          </Button>
          
          {isDraft && (
            <Button variant="primary" onClick={handleStage} disabled={actionLoading || loading}>
              {actionLoading ? tShipments('returns.staging') : tShipments('returns.stageItems')}
            </Button>
          )}

          {isStaged && (
            <Button variant="primary" onClick={handleShip} disabled={actionLoading || loading}>
              {actionLoading ? tShipments('returns.dispatching') : tShipments('returns.dispatch')}
            </Button>
          )}
        </div>
      </div>
    </SlideOver>
  );
}

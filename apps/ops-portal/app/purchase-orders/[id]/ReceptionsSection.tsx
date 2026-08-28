'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { formatLocalDate } from '@/lib/date';
import { reportError } from '@/lib/api';
import toast from 'react-hot-toast';
import { getErrorMessage } from '@herobm/shared';
import * as api from '@herobm/sdk';

import { useTranslations } from 'next-intl';
import { DataTable } from '@/components/shared/DataTable';
import { Button } from '@/components/shared/Button';

interface ReceptionLine {
  goodsReceivedLineId: string;
  goodsReceivedId: string;
  productId: string;
  quantityReceived: string;
  matchStatus: string;
  purchaseOrderLineId: string | null;
  purchaseOrderId: string | null;
  receiptNumber: string;
  packingSlipNumber: string | null;
  vendorId: string | null;
  vendorName: string | null;
  createdOn: string;
  locationId: string;
  productNumber: string | null;
  productName: string | null;
  orderNumber: string | null;
}

export default function ReceptionsSection({ orderId }: { orderId: string }) {
  const tCommon = useTranslations('common');
  const t = useTranslations('purchaseOrders.receptionsSection');
  const [receptions, setReceptions] = useState<ReceptionLine[]>([]);
  const [loading, setLoading] = useState(true);

  const loadReceptions = async () => {
    setLoading(true);
    try {
      const { data } = await api.goodsReceivedControllerFindAllLines({ purchaseOrderId: orderId } as unknown as Parameters<typeof api.goodsReceivedControllerFindAllLines>[0]);
      setReceptions((data.data || []) as unknown as ReceptionLine[]);
    } catch (err) {
      toast.error('Failed to load goods receipts: ' + getErrorMessage(err));
      reportError(err, 'ReceptionsSection');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (orderId) {
      loadReceptions();
    }
  }, [orderId]);

  const handleUnlink = async (lineId: string) => {
    if (!confirm(t('confirmUnlink'))) return;
    try {
      await api.goodsReceivedControllerUnresolveAllocation(lineId, { method: 'POST' });
      toast.success(t('success'));
      loadReceptions();
    } catch (err) {
      reportError(err, 'ReceptionsSection');
      toast.error(t('error'));
    }
  };

  return (
    <div id="receptions-section" className="card">
      <div className="flex justify-between items-center mb-4">
        <h3 className="section-heading">
          { }
          <span className="material-symbols-outlined">inventory_2</span>
          {t('title')}
        </h3>
      </div>
      
      {loading ? (
        <p className="text-sm text-[var(--text-muted)] py-5 text-center">
          {t('loading')}
        </p>
      ) : receptions.length === 0 ? (
        <p className="text-sm text-[var(--text-muted)] py-5 text-center">
          {t('noReceptions')}
        </p>
      ) : (
        <DataTable
          data={receptions}
          keyExtractor={(rec) => rec.goodsReceivedLineId}
          columns={[
            {
              header: t('receipt'),
              render: (rec) => (
                <Link href={`/receiving/${rec.goodsReceivedId}`} className="text-[var(--accent)] font-medium hover:underline">
                  {rec.receiptNumber}
                </Link>
              )
            },
            {
              header: t('product'),
              render: (rec) => (
                <div className="text-[13px]">
                  <div className="font-semibold">{rec.productNumber || rec.productId.substring(0, 8)}</div>
                  <div className="text-xs text-[var(--text-secondary)]">{rec.productName || tCommon('unknownProduct')}</div>
                </div>
              )
            },
            {
              header: t('receivedQty'),
              align: 'right',
              render: (rec) => <span className="font-semibold tabular-nums">{rec.quantityReceived}</span>
            },
            {
              header: t('dateReceived'),
              render: (rec) => <span className="text-[13px] text-[var(--text-secondary)]">{formatLocalDate(rec.createdOn)}</span>
            },
            {
              header: t('action'),
              align: 'right',
              width: 80,
              render: (rec) => (
                <Button 
                  onClick={() => handleUnlink(rec.goodsReceivedLineId)}
                  variant="secondary" size="sm"
                  title={t('unlinkTitle')}
                >
                  {t('unlink')}
                </Button>
              )
            }
          ]}
          mobileCard={(rec: ReceptionLine) => (
            <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] p-4 flex flex-col">
              <div className="font-semibold text-sm text-[var(--accent)] mb-1 flex justify-between">
                <Link href={`/receiving/${rec.goodsReceivedId}`} className="hover:underline">
                  {rec.receiptNumber}
                </Link>
              </div>
              <div className="text-sm text-slate-600 font-medium mb-3">
                <div className="font-semibold text-slate-800">{rec.productNumber || rec.productId.substring(0, 8)}</div>
                <div className="text-xs">{rec.productName || tCommon('unknownProduct')}</div>
              </div>
              
              <div className="flex flex-col gap-0 border-t border-slate-100 pt-1">
                <div className="flex justify-between py-1">
                  <span className="text-xs font-medium text-slate-500">{t('receivedQty')}</span>
                  <span className="font-bold tabular-nums text-sm">{rec.quantityReceived}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-xs font-medium text-slate-500">{t('dateReceived')}</span>
                  <span className="text-sm text-slate-600">{formatLocalDate(rec.createdOn)}</span>
                </div>
              </div>
              <div className="flex justify-end mt-2 pt-2 border-t border-slate-100">
                <Button 
                  onClick={() => handleUnlink(rec.goodsReceivedLineId)}
                  variant="secondary" size="sm"
                  title={t('unlinkTitle')}
                >
                  {t('unlink')}
                </Button>
              </div>
            </div>
          )}
        />
      )}
    </div>
  );
}

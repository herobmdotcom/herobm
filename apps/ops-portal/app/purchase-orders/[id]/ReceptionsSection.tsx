'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { reportError } from '@/lib/api';
import toast from 'react-hot-toast';
import * as api from '@modbm/sdk';

import { useTranslations } from 'next-intl';

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
      const { data } = await api.goodsReceivedControllerFindAllLines({ purchaseOrderId: orderId } as any);
      setReceptions((data as unknown as ReceptionLine[]) || []);
    } catch (err) {
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
          {/* eslint-disable-next-line i18next/no-literal-string */}
          <span className="material-symbols-outlined">inventory_2</span>
          {t('title')}
        </h3>
      </div>
      
      {loading ? (
        <p className="text-sm" style={{ color: 'var(--text-muted)', padding: '20px 0', textAlign: 'center' }}>
          {t('loading')}
        </p>
      ) : receptions.length === 0 ? (
        <p className="text-sm" style={{ color: 'var(--text-muted)', padding: '20px 0', textAlign: 'center' }}>
          {t('noReceptions')}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="table-lines w-full">
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>{t('receipt')}</th>
                <th style={{ textAlign: 'left', padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>{t('product')}</th>
                <th style={{ textAlign: 'right', padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>{t('receivedQty')}</th>
                <th style={{ textAlign: 'left', padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>{t('dateReceived')}</th>
                <th style={{ textAlign: 'right', padding: '12px 16px', borderBottom: '1px solid var(--border)', width: 80 }}>{t('action')}</th>
              </tr>
            </thead>
            <tbody>
              {receptions.map((rec) => (
                <tr key={rec.goodsReceivedLineId} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '12px 16px' }}>
                    <Link href={`/receiving/${rec.goodsReceivedId}`} className="text-[var(--accent)] font-medium hover:underline">
                      {rec.receiptNumber}
                    </Link>
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: 13 }}>
                    <div className="font-semibold">{rec.productNumber || rec.productId.substring(0, 8)}</div>
                    <div className="text-xs text-[var(--text-secondary)]">{rec.productName || tCommon('unknownProduct')}</div>
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
                    {rec.quantityReceived}
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--text-secondary)' }}>
                    {new Date(rec.createdOn).toLocaleDateString()}
                  </td>
                  <td style={{ padding: '8px 16px', textAlign: 'right' }}>
                    <button 
                      onClick={() => handleUnlink(rec.goodsReceivedLineId)}
                      className="btn btn-secondary btn-sm"
                      title={t('unlinkTitle')}
                    >
                      {t('unlink')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

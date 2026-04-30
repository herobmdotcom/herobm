'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiFetch, reportError } from '@/lib/api';
import toast from 'react-hot-toast';

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
  const [receptions, setReceptions] = useState<ReceptionLine[]>([]);
  const [loading, setLoading] = useState(true);

  const loadReceptions = async () => {
    setLoading(true);
    try {
      const { data } = await apiFetch<{ data: ReceptionLine[] }>(`/api/goods-received/lines?purchaseOrderId=${orderId}`);
      setReceptions(data || []);
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
    if (!confirm('Are you sure you want to unlink this reception line? It will be placed back into the Goods Received pool for manual allocation.')) return;
    try {
      await apiFetch(`/api/goods-received/lines/${lineId}/unresolve`, { method: 'POST' });
      toast.success('Reception unlinked successfully');
      loadReceptions();
    } catch (err) {
      reportError(err, 'ReceptionsSection');
      toast.error('Failed to unlink reception');
    }
  };

  return (
    <div id="receptions-section" className="card">
      <div className="flex justify-between items-center mb-4">
        <h3 className="section-heading">
          {/* eslint-disable-next-line i18next/no-literal-string */}
          <span className="material-symbols-outlined">inventory_2</span>
          Receptions
        </h3>
      </div>
      
      {loading ? (
        <p className="text-sm" style={{ color: 'var(--text-muted)', padding: '20px 0', textAlign: 'center' }}>
          Loading receptions...
        </p>
      ) : receptions.length === 0 ? (
        <p className="text-sm" style={{ color: 'var(--text-muted)', padding: '20px 0', textAlign: 'center' }}>
          No goods received lines are currently allocated to this purchase order.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="table-lines w-full">
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>Receipt</th>
                <th style={{ textAlign: 'left', padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>Product</th>
                <th style={{ textAlign: 'right', padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>Received Qty</th>
                <th style={{ textAlign: 'left', padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>Date Received</th>
                <th style={{ textAlign: 'right', padding: '12px 16px', borderBottom: '1px solid var(--border)', width: 80 }}>Action</th>
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
                      title="Unlink reception from this PO"
                    >
                      Unlink
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

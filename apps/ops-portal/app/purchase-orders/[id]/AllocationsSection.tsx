'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { reportError } from '@/lib/api';
import toast from 'react-hot-toast';
import * as api from '@modbm/sdk';

import { useTranslations } from 'next-intl';
import type { Allocation } from './types';

interface AllocationsSectionProps {
  orderId: string;
  allocations: Allocation[];
  loading: boolean;
  onAllocationsChanged: () => void;
}

export default function AllocationsSection({ orderId, allocations, loading, onAllocationsChanged }: AllocationsSectionProps) {
  const tCommon = useTranslations('common');

  const t = useTranslations('purchaseOrders');

  const handleUnlink = async (id: string) => {
    if (!confirm(t('allocationsSection.confirmUnallocate'))) return;
    try {
      await api.allocationsControllerUnlinkDemand(id, {});
      toast.success(t('allocationsSection.success'));
      onAllocationsChanged();
    } catch (err) {
      reportError(err, 'AllocationsSection');
      toast.error(t('allocationsSection.error'));
    }
  };

  return (
    <div id="allocations-section" className="card">
      <div className="flex justify-between items-center mb-4">
        <h3 className="section-heading">
          {/* eslint-disable-next-line i18next/no-literal-string */}
          <span className="material-symbols-outlined">link</span>
          {t('allocationsSection.title')}
        </h3>
      </div>
      
      {loading ? (
        <p className="text-sm" style={{ color: 'var(--text-muted)', padding: '20px 0', textAlign: 'center' }}>
          {t('allocationsSection.loading')}
        </p>
      ) : allocations.length === 0 ? (
        <p className="text-sm" style={{ color: 'var(--text-muted)', padding: '20px 0', textAlign: 'center' }}>
          {t('allocationsSection.noAllocations')}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="table-lines w-full">
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>{t('allocationsSection.salesOrder')}</th>
                <th style={{ textAlign: 'left', padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>{t('allocationsSection.product')}</th>
                <th style={{ textAlign: 'right', padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>{t('allocationsSection.allocatedQty')}</th>
                <th style={{ textAlign: 'left', padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>{t('allocationsSection.dateRequested')}</th>
                <th style={{ textAlign: 'right', padding: '12px 16px', borderBottom: '1px solid var(--border)', width: 80 }}>{t('allocationsSection.action')}</th>
              </tr>
            </thead>
            <tbody>
              {allocations.map((alloc) => (
                <tr key={alloc.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '12px 16px' }}>
                    <Link href={`/sales-orders/${alloc.salesOrderId}`} className="text-[var(--accent)] font-medium hover:underline">
                      {alloc.orderNumber || alloc.salesOrderId.substring(0, 8)}
                    </Link>
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: 13 }}>
                    {alloc.productName || tCommon('unknownProduct')}
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
                    {alloc.quantity}
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--text-secondary)' }}>
                    {new Date(alloc.createdOn).toLocaleDateString()}
                  </td>
                  <td style={{ padding: '8px 16px', textAlign: 'right' }}>
                    <button 
                      onClick={() => handleUnlink(alloc.id)}
                      className="btn btn-secondary btn-sm"
                      title={t('allocationsSection.unallocateTitle')}
                    >
                      {t('allocationsSection.unallocate')}
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

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { reportError } from '@/lib/api';
import toast from 'react-hot-toast';
import * as api from '@modbm/sdk';

import { useTranslations } from 'next-intl';
import type { Allocation } from './types';
import { DataTable } from '@/components/shared/DataTable';

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
        <DataTable
          data={allocations}
          keyExtractor={(alloc) => alloc.id}
          columns={[
            {
              header: t('allocationsSection.salesOrder'),
              render: (alloc) => (
                <Link href={`/sales-orders/${alloc.salesOrderId}`} className="text-[var(--accent)] font-medium hover:underline">
                  {alloc.orderNumber || alloc.salesOrderId.substring(0, 8)}
                </Link>
              )
            },
            {
              header: t('allocationsSection.product'),
              render: (alloc) => <span className="text-[13px]">{alloc.productName || tCommon('unknownProduct')}</span>
            },
            {
              header: t('allocationsSection.allocatedQty'),
              align: 'right',
              render: (alloc) => <span className="font-semibold tabular-nums">{alloc.quantity}</span>
            },
            {
              header: t('allocationsSection.dateRequested'),
              render: (alloc) => <span className="text-[13px] text-[var(--text-secondary)]">{new Date(alloc.createdOn).toLocaleDateString()}</span>
            },
            {
              header: t('allocationsSection.action'),
              align: 'right',
              width: 80,
              render: (alloc) => (
                <button 
                  onClick={() => handleUnlink(alloc.id)}
                  className="btn btn-secondary btn-sm"
                  title={t('allocationsSection.unallocateTitle')}
                >
                  {t('allocationsSection.unallocate')}
                </button>
              )
            }
          ]}
          mobileCard={(alloc: any) => {
             return (
               <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] p-4 flex flex-col">
                  <div className="font-semibold text-sm text-[var(--accent)] mb-1">
                    <Link href={`/sales-orders/${alloc.salesOrderId}`} className="hover:underline">
                      {alloc.orderNumber || alloc.salesOrderId.substring(0, 8)}
                    </Link>
                  </div>
                  <div className="text-sm text-slate-600 font-medium mb-3">
                    {alloc.productName || tCommon('unknownProduct')}
                  </div>
                  
                  <div className="flex flex-col gap-0 border-t border-slate-100 pt-1">
                    <div className="flex justify-between py-1">
                      <span className="text-xs font-medium text-slate-500">{t('allocationsSection.allocatedQty')}</span>
                      <span className="font-bold tabular-nums text-sm">{alloc.quantity}</span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-xs font-medium text-slate-500">{t('allocationsSection.dateRequested')}</span>
                      <span className="text-sm text-slate-600">{new Date(alloc.createdOn).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <div className="flex justify-end mt-2 pt-2 border-t border-slate-100">
                    <button 
                      onClick={() => handleUnlink(alloc.id)}
                      className="btn btn-secondary btn-sm"
                      title={t('allocationsSection.unallocateTitle')}
                    >
                      {t('allocationsSection.unallocate')}
                    </button>
                  </div>
               </div>
             );
          }}
        />
      )}
    </div>
  );
}

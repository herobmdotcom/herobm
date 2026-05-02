'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiFetch, reportError } from '@/lib/api';
import toast from 'react-hot-toast';

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

  const handleUnlink = async (id: string) => {
    if (!confirm('Are you sure you want to unallocate this demand? It will be placed back into the Open Demands pool.')) return;
    try {
      await apiFetch(`/api/allocations/${id}/unlink`, { method: 'POST' });
      toast.success('Demand unallocated successfully');
      onAllocationsChanged();
    } catch (err) {
      reportError(err, 'AllocationsSection');
      toast.error('Failed to unallocate demand');
    }
  };

  return (
    <div id="allocations-section" className="card">
      <div className="flex justify-between items-center mb-4">
        <h3 className="section-heading">
          {/* eslint-disable-next-line i18next/no-literal-string */}
          <span className="material-symbols-outlined">link</span>
          Allocations
        </h3>
      </div>
      
      {loading ? (
        <p className="text-sm" style={{ color: 'var(--text-muted)', padding: '20px 0', textAlign: 'center' }}>
          Loading allocations...
        </p>
      ) : allocations.length === 0 ? (
        <p className="text-sm" style={{ color: 'var(--text-muted)', padding: '20px 0', textAlign: 'center' }}>
          No open sales demand is currently allocated to this purchase order.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="table-lines w-full">
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>Sales Order</th>
                <th style={{ textAlign: 'left', padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>Product</th>
                <th style={{ textAlign: 'right', padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>Allocated Qty</th>
                <th style={{ textAlign: 'left', padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>Date Requested</th>
                <th style={{ textAlign: 'right', padding: '12px 16px', borderBottom: '1px solid var(--border)', width: 80 }}>Action</th>
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
                      title="Unallocate demand from this PO"
                    >
                      Unallocate
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

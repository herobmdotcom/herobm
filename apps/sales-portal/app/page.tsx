'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Shell from '@/components/Shell';
import { apiFetch } from '@/lib/api';

interface UnifiedOrder {
  id: string;
  orderNumber: string;
  name: string;
  customerOrderNumber: string;
  stateCode: string;
  source: 'abm' | 'app';
  createdBy: string;
  createdOn: string | null;
  totalPrice: string | null;
}

function StateBadge({ state }: { state: string }) {
  return <span className={`badge badge-${state}`}>{state}</span>;
}

function SourceBadge({ source }: { source: 'abm' | 'app' }) {
  return <span className={`badge badge-${source}`}>{source === 'abm' ? 'ABM' : 'App'}</span>;
}

export default function OrdersPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<UnifiedOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const loadOrders = async () => {
    setLoading(true);
    try {
      const searchParam = search ? `&search=${encodeURIComponent(search)}` : '';
      const data = await apiFetch<{ data: UnifiedOrder[] }>(
        `/api/orders?limit=100${searchParam}`,
      );
      setOrders(data.data);
    } catch (err) {
      console.error('Failed to load orders:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
  }, []);

  const handleSearch = () => {
    loadOrders();
  };

  const handleRowClick = (order: UnifiedOrder) => {
    if (order.source === 'app') {
      router.push(`/orders/${order.id}?source=app`);
    } else {
      router.push(`/orders/${encodeURIComponent(order.orderNumber)}?source=abm`);
    }
  };

  return (
    <Shell>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Orders</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            Manage sales orders
          </p>
        </div>
        <button
          id="btn-new-order"
          className="btn btn-primary"
          onClick={() => router.push('/orders/new')}
        >
          ➕ New Order
        </button>
      </div>

      {/* Search bar */}
      <div className="flex gap-3 mb-6">
        <input
          id="orders-search"
          className="input"
          style={{ maxWidth: 360 }}
          placeholder="Search orders…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
        />
        <button className="btn btn-secondary" onClick={handleSearch}>
          Search
        </button>
      </div>

      {/* Orders table */}
      <div className="card scroll-area" style={{ flex: 1 }}>
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <p style={{ color: 'var(--text-muted)' }}>Loading orders…</p>
          </div>
        ) : orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <p className="text-lg mb-2" style={{ color: 'var(--text-muted)' }}>
              No orders found
            </p>
            <button
              className="btn btn-primary"
              onClick={() => router.push('/orders/new')}
            >
              ➕ Create Order
            </button>
          </div>
        ) : (
          <table className="table-lines">
            <thead>
              <tr>
                <th>Order #</th>
                <th>Customer / Name</th>
                <th>Status</th>
                <th>Source</th>
                <th>Customer PO</th>
                <th style={{ textAlign: 'right' }}>Total</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr
                  key={`${order.source}-${order.id}`}
                  className="cursor-pointer"
                  onClick={() => handleRowClick(order)}
                >
                  <td style={{ fontWeight: 600, color: 'var(--accent)' }}>
                    {order.orderNumber}
                  </td>
                  <td>{order.name || '—'}</td>
                  <td><StateBadge state={order.stateCode} /></td>
                  <td><SourceBadge source={order.source} /></td>
                  <td style={{ color: 'var(--text-secondary)' }}>
                    {order.customerOrderNumber || '—'}
                  </td>
                  <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 500 }}>
                    {order.totalPrice && parseFloat(order.totalPrice) !== 0
                      ? `€${parseFloat(order.totalPrice).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                      : '—'}
                  </td>
                  <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                    {order.createdOn
                      ? new Date(order.createdOn).toLocaleDateString()
                      : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </Shell>
  );
}

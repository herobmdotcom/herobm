'use client';

import { useState, useEffect } from 'react';
import Shell from '@/components/Shell';
import { apiFetch } from '@/lib/api';

interface Summary {
  accounts: number;
  products: number;
  inventoryLevels: number;
  orderLines: number;
}

function StatCard({ label, value, icon, loading }: { label: string; value: number | null; icon: string; loading: boolean }) {
  return (
    <div className="rounded-xl p-6 transition-all duration-200"
      style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
      <div className="flex items-center gap-3 mb-3">
        <span className="text-2xl">{icon}</span>
        <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>{label}</span>
      </div>
      {loading ? (
        <div className="h-9 w-24 rounded animate-pulse" style={{ background: 'var(--bg-secondary)' }} />
      ) : (
        <p className="text-3xl font-bold" style={{ color: 'var(--text-primary)' }}>
          {value !== null ? value.toLocaleString() : '—'}
        </p>
      )}
    </div>
  );
}

/** This component only mounts AFTER AuthGate confirms login */
function DashboardContent() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<Summary>('/api/dashboard/summary')
      .then(setSummary)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <>
      <h2 className="text-2xl font-bold mb-6">Dashboard</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <StatCard label="Accounts" value={summary?.accounts ?? null} icon="🏢" loading={loading} />
        <StatCard label="Products" value={summary?.products ?? null} icon="🏷️" loading={loading} />
        <StatCard label="Inventory Levels" value={summary?.inventoryLevels ?? null} icon="📦" loading={loading} />
        <StatCard label="Order Lines" value={summary?.orderLines ?? null} icon="📋" loading={loading} />
      </div>
    </>
  );
}

export default function DashboardPage() {
  return (
    <Shell>
      <DashboardContent />
    </Shell>
  );
}

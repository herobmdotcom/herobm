/* eslint-disable */
// @ts-nocheck
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { businessReportsControllerGetReports } from '@herobm/sdk';

export default function ReportingDashboard() {
  const router = useRouter();
  const [hasNoReports, setHasNoReports] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    businessReportsControllerGetReports()
      .then((res: Record<string, unknown>) => {
        const data = (res.data as Record<string, unknown>[]) || (res as Record<string, unknown>[]);
        if (data && data.length > 0) {
          // Sort by name or prioritize sales reports
          const salesReports = data.filter(r => r.slug.startsWith('sales-'));
          const target = salesReports.length > 0 ? salesReports[0] : data[0];
          router.replace(`/reporting/${target.slug}`);
        } else {
          setHasNoReports(true);
        }
      })
      .catch((err) => {
        console.error(err);
        setError(true);
        setHasNoReports(true);
      });
  }, [router]);

  if (hasNoReports) {
    return (
      <div className="p-12 flex flex-col items-center justify-center h-full text-center mt-12">
        <span className="material-symbols-outlined text-[64px] mb-4" style={{ color: 'var(--text-muted)' }}>bar_chart</span>
        <h2 className="text-xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>No Reports Available</h2>
        <p className="text-sm mb-6 max-w-md" style={{ color: 'var(--text-muted)' }}>
          {error 
            ? "There was an error loading the business reports. They might not be configured correctly."
            : "There are currently no business reports available to view."}
        </p>
        <button 
          onClick={() => router.push('/reporting/config')}
          className="px-4 py-2 text-sm font-bold rounded-lg transition-all bg-[#006b5c] text-white hover:brightness-110"
        >
          Go to Configuration
        </button>
      </div>
    );
  }

  return (
    <div className="p-8 font-bold" style={{ color: 'var(--text-muted)' }}>
      Loading Business Reports...
    </div>
  );
}

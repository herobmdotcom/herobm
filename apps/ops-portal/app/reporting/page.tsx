/* eslint-disable */
// @ts-nocheck
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { businessReportsControllerGetReports } from '@modbm/sdk';

export default function ReportingDashboard() {
  const router = useRouter();

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
          router.replace('/reporting/config'); // fallback to config if no reports exist
        }
      })
      .catch((err) => {
        console.error(err);
        router.replace('/reporting/config');
      });
  }, [router]);

  return (
    <div className="p-8 text-gray-500 font-bold">
      Loading Business Reports...
    </div>
  );
}

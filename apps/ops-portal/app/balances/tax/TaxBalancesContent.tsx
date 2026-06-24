'use client';

import { useEffect, useState } from 'react';
import * as api from '@herobm/sdk';
import { reportError } from '@/lib/api';
import EntityHeader from '@/components/shared/EntityHeader';
import { toast } from 'react-hot-toast';

export default function TaxBalancesContent() {
  const [balances, setBalances] = useState<api.BasSummaryRowDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  
  // Date selection
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');

  const fetchTaxSummary = async () => {
    setIsLoading(true);
    try {
      const params: api.TaxBasControllerGetBasSummaryParams = {};
      if (fromDate) params.fromDate = fromDate;
      if (toDate) params.toDate = toDate;
      
      const response = await api.taxBasControllerGetBasSummary(params);
      setBalances(response.data);
    } catch (error) {
      reportError(error, 'TaxBalancesContent_fetchTaxSummary');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTaxSummary();
  }, [fromDate, toDate]);

  const handleCopy = (id: string, amount: number | null | undefined) => {
    const val = amount !== undefined && amount !== null ? amount.toString() : '0';
    navigator.clipboard.writeText(val);
    toast.success(`Copied ${val} to clipboard`);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const headerActions = (
    <div className="flex flex-wrap items-end gap-3">
      <div className="flex flex-col gap-1">
        <label className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">From Date</label>
        <input 
          type="date" 
          value={fromDate}
          onChange={(e) => setFromDate(e.target.value)}
          className="input text-sm h-9 px-3"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">To Date</label>
        <input 
          type="date" 
          value={toDate}
          onChange={(e) => setToDate(e.target.value)}
          className="input text-sm h-9 px-3"
        />
      </div>
      <button 
        onClick={fetchTaxSummary}
        className="btn btn-primary btn-sm h-9"
      >
        Refresh
      </button>
    </div>
  );

  return (
    <div className="p-4 md:p-6 lg:p-8 flex flex-col gap-6 h-full w-full max-w-4xl mx-auto">
      <EntityHeader
        title="ATO BAS Report"
        subtitle="Business Activity Statement Summary"
        actions={headerActions}
        showPrint={true}
      />
      
      {isLoading ? (
        <div className="flex items-center justify-center p-12 text-[var(--text-muted)]">
          Loading report...
        </div>
      ) : (
        <div className="bg-white border border-[var(--border)] rounded-lg overflow-hidden flex flex-col">
          {balances.map((row) => (
            <div 
              key={row.id} 
              className="group/row flex items-center border-b border-[var(--border)] last:border-b-0 px-6 py-4 transition-colors"
            >
              <div className="w-16 font-bold text-[var(--text-primary)] shrink-0">
                {row.id}
              </div>
              <div className="flex-1 text-[var(--text-secondary)]">
                {row.description}
              </div>
              <button
                type="button"
                onClick={() => handleCopy(row.id, row.amount)}
                className="w-32 text-right text-lg font-mono tracking-tight text-[var(--text-primary)] bg-white px-3 py-1 rounded border border-[var(--border)] hover:border-[var(--primary)] focus:border-[var(--primary)] focus:outline-none transition-colors cursor-pointer"
                title="Click to copy"
              >
                {row.amount !== undefined && row.amount !== null ? row.amount.toString() : '0'}
              </button>
            </div>
          ))}
          {balances.length === 0 && (
            <div className="p-8 text-center text-[var(--text-muted)]">
              No data available for this period.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

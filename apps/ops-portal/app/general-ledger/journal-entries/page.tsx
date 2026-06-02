'use client';

import { useDocumentTitle } from '@/hooks/useDocumentTitle';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import DataGrid from '@/components/DataGrid';
import type { ColDef } from 'ag-grid-community';
import { useTranslations } from 'next-intl';
import JournalEntrySlideOver, { JournalEntry } from './JournalEntrySlideOver';

export default function JournalEntriesPage() {
  const t = useTranslations('gl.journalEntries');
  const tCommon = useTranslations('common');
  const router = useRouter();

  const sourceLabel = (type: string) => {
    const labels: Record<string, string> = {
      sales_invoice: t('sourceSalesInvoice'),
      purchase_invoice: t('sourcePurchaseInvoice'),
      sales_credit_note: t('sourceSalesCreditNote'),
      manual: t('sourceManual'),
    };
    return labels[type] || type;
  };

  useDocumentTitle(t('title'));
  
  const searchParams = useSearchParams();
  const entryParam = searchParams.get('entry') || '';

  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [sourceType, setSourceType] = useState('');

  const [selectedEntry, setSelectedEntry] = useState<JournalEntry | null>(null);

  const prevEntryParam = useRef(entryParam);
  useEffect(() => {
    if (entryParam !== prevEntryParam.current) {
      prevEntryParam.current = entryParam;
    }
  }, [entryParam]);

  const columns = useMemo<ColDef[]>(() => [
    { 
      field: 'entryNumber', 
      headerName: t('columns.entryNumber'), 
      width: 130, 
      pinned: 'left',
      cellStyle: { fontWeight: 'bold', color: 'var(--accent)', cursor: 'pointer' }
    },
    { 
      field: 'entryDate', 
      headerName: t('columns.date'), 
      width: 120,
      valueFormatter: (p: any) => p.value ? new Date(p.value).toLocaleDateString() : ''
    },
    {
      field: 'partyName',
      headerName: t('columns.party'),
      width: 200,
      cellRenderer: (p: any) => {
        if (!p.value) return <span className="text-gray-400">{t('na')}</span>;
        const link = p.data.partyType === 'customer' 
          ? `/accounts/${p.data.partyId}` 
          : `/suppliers/${p.data.partyId}`;
        return (
          <a 
            href={link} 
            onClick={(e) => e.stopPropagation()}
            className="text-[var(--accent)] hover:underline"
          >
            {p.value}
          </a>
        );
      }
    },
    { 
      field: 'sourceType', 
      headerName: t('columns.source'), 
      width: 150,
      valueFormatter: (p: any) => p.value ? sourceLabel(p.value) : ''
    },
    {
      field: 'sourceNumber',
      headerName: t('sourceDocument'),
      width: 160,
      cellRenderer: (p: any) => {
        if (!p.value) return null;
        let link = '';
        if (p.data.sourceType === 'sales_invoice') link = `/sales-invoices/${p.data.sourceId}`;
        if (p.data.sourceType === 'purchase_invoice') link = `/procurement/invoices/${p.data.sourceId}`;
        if (p.data.sourceType === 'sales_credit_note') link = `/sales-orders/credit-notes/${p.data.sourceId}`;
        
        if (!link) return <span>{p.value}</span>;

        return (
          <a 
            href={link} 
            onClick={(e) => e.stopPropagation()}
            className="text-[var(--accent)] hover:underline"
          >
            {p.value}
          </a>
        );
      }
    },
    { 
      field: 'memo', 
      headerName: t('columns.memo'), 
      flex: 1, 
      minWidth: 200 
    },
    { 
      field: 'createdBy', 
      headerName: t('columns.createdBy'), 
      width: 140 
    }
  ], [t]);

  const endpoint = `/api/gl/journal-entries?fromDate=${fromDate}&toDate=${toDate}&sourceType=${sourceType}`;

  return (
    <>
      <DataGrid<JournalEntry>
        endpoint={endpoint}
        columns={columns}
        gridKey="gl-journal-entries"
        searchPlaceholder={t('searchPlaceholder')}
        exportFileName="journal-entries"
        fetchAll={true}
        initialSearch={entryParam}
        onRowClicked={(row) => setSelectedEntry(row)}
        pageTitle={t('title')}
        secondaryHeader={
          <div className="flex flex-wrap items-center justify-end gap-4 w-full">
            <select
              value={sourceType}
              onChange={(e) => setSourceType(e.target.value)}
              className="input text-xs h-9 border-gray-200 !w-auto min-w-[240px] bg-white rounded-lg"
            >
              <option value="">{t('allSources')}</option>
              <option value="sales_invoice">{t('sourceSalesInvoice')}</option>
              <option value="purchase_invoice">{t('sourcePurchaseInvoice')}</option>
              <option value="sales_credit_note">{t('sourceSalesCreditNote')}</option>
              <option value="manual">{t('sourceManual')}</option>
            </select>

            <div className="flex items-center gap-3">
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="input text-xs h-9 border-gray-200 bg-white px-3 text-gray-500 rounded-lg w-auto"
                title={t('fromDate')}
              />
              <span className="text-gray-300 font-bold">→</span>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="input text-xs h-9 border-gray-200 bg-white px-3 text-gray-500 rounded-lg w-auto"
                title={t('toDate')}
              />
            </div>
          </div>
        }
        headerActions={
          <button
            onClick={() => router.push('/general-ledger/journal-entries/new')}
            className="px-4 py-2 text-sm font-bold rounded-lg transition-all bg-[#006b5c] text-white hover:brightness-110 shadow-sm whitespace-nowrap"
          >
            + {t('newEntry')}
          </button>
        }
      />

      <JournalEntrySlideOver
        entry={selectedEntry}
        onClose={() => setSelectedEntry(null)}
      />
    </>
  );
}

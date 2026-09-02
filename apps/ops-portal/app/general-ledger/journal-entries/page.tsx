'use client';

import { useDocumentTitle } from '@/hooks/useDocumentTitle';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/shared/Button';
import DataGrid from '@/components/DataGrid';
import type { ColDef, ValueFormatterParams, ICellRendererParams } from 'ag-grid-community';
import { useTranslations } from 'next-intl';
import { routes } from '@/lib/routes';
import JournalEntrySlideOver, { JournalEntry } from './JournalEntrySlideOver';
import FxRevalSlideOver from './FxRevalSlideOver';

interface JournalEntryRow extends JournalEntry {
  partyType?: string | null;
  partyId?: string | null;
  partyName?: string | null;
  sourceNumber?: string | null;
}

export default function JournalEntriesPage() {
  const t = useTranslations('gl.journalEntries');
  const tCommon = useTranslations('common');
  const router = useRouter();

  const sourceLabel = (type: string) => {
    const rawType = (type || '').toLowerCase();
    const labels: Record<string, string> = {
      sales_invoice: t('sourceSalesInvoice'),
      purchase_invoice: t('sourcePurchaseInvoice'),
      sales_credit_note: t('sourceSalesCreditNote'),
      payment_entry: t('sourcePaymentEntry'),
      manual: t('sourceManual'),
      adjustment: t('sourceTypes.adjustment'),
      fx_revaluation: t('sourceTypes.fx_revaluation'),
      initial_import: t('sourceTypes.initial_import'),
      inventory_adjustment: t('sourceTypes.inventory_adjustment'),
      inventory_dispatch: t('sourceTypes.inventory_dispatch'),
      inventory_receipt: t('sourceTypes.inventory_receipt'),
      opening_balance: t('sourceTypes.opening_balance'),
      payroll: t('sourceTypes.payroll'),
      purchase_debit_note: t('sourceTypes.purchase_debit_note'),
      purchase_invoice_reversal: t('sourceTypes.purchase_invoice_reversal'),
      sales_invoice_reversal: t('sourceTypes.sales_invoice_reversal'),
      tax_settlement: t('sourceTypes.tax_settlement'),
      year_end_close: t('sourceTypes.year_end_close'),
    };
    if (labels[rawType]) return labels[rawType];
    
    return type
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  };

  useDocumentTitle(t('title'));
  
  const searchParams = useSearchParams();
  const entryParam = searchParams.get('entry') || '';

  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [sourceType, setSourceType] = useState('');

  const [selectedEntry, setSelectedEntry] = useState<JournalEntry | null>(null);
  const [isFxRevalOpen, setIsFxRevalOpen] = useState(false);

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
      sort: 'desc',
      valueFormatter: (p: ValueFormatterParams<JournalEntryRow>) => {
        if (!p.value) return '';
        const dateStr = (p.value as string).split('T')[0];
        const [year, month, day] = dateStr.split('-');
        return `${day}/${month}/${year}`;
      }
    },
    {
      field: 'partyName',
      headerName: t('columns.party'),
      width: 200,
      cellRenderer: (p: ICellRendererParams<JournalEntryRow>) => {
        if (!p.value || !p.data) return <span className="text-gray-400">{t('na')}</span>;
        const link = p.data.partyType === 'customer' 
          ? routes.customers.detail(p.data.partyId || '') 
          : routes.suppliers.detail(p.data.partyId || '');
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
      valueFormatter: (p: ValueFormatterParams<JournalEntryRow>) => p.value ? sourceLabel(p.value as string) : ''
    },
    {
      field: 'sourceNumber',
      headerName: t('sourceDocument'),
      width: 160,
      cellRenderer: (p: ICellRendererParams<JournalEntryRow>) => {
        if (!p.value || !p.data) return null;
        let link = '';
        if (p.data.sourceType === 'sales_invoice') link = routes.salesInvoices.detail(p.data.sourceId || '');
        if (p.data.sourceType === 'purchase_invoice') link = routes.supplierInvoices.detail(p.data.sourceId || '');
        if (p.data.sourceType === 'sales_credit_note') link = routes.salesCreditNotes.detail(p.data.sourceId || '');
        if (p.data.sourceType === 'payment_entry') link = routes.payments.detail(p.data.sourceId || '');
        if (p.data.sourceType === 'inventory_receipt') link = routes.receiving.detail(p.data.sourceId || '');
        
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
      width: 140,
      valueGetter: (params) => {
        const val = params.data?.createdBy;
        if (!val || val === '[object Object]') return 'admin';
        if (typeof val === 'object') return (val as { username?: string; userId?: string }).username || (val as { username?: string; userId?: string }).userId || 'admin';
        return val;
      }
    }
  ], [t]);

  const endpoint = `/api/gl/journal-entries?fromDate=${fromDate}&toDate=${toDate}&sourceType=${sourceType}`;

  return (
    <>
      <DataGrid<JournalEntryRow>
        endpoint={endpoint}
        columns={columns}
        gridKey="gl-journal-entries"
        searchPlaceholder={t('searchPlaceholder')}
        exportFileName="journal-entries"
        fetchAll={true}
        initialSearch={entryParam}
        onRowClicked={(row) => setSelectedEntry(row)}
        pageTitle={t('title')}
        defaultSortModel={[{ colId: 'entryDate', sort: 'desc' }]}
        secondaryHeader={
          <div className="flex flex-wrap items-center justify-start gap-2 sm:gap-4 w-full">
            <select
              value={sourceType}
              onChange={(e) => setSourceType(e.target.value)}
              className="input text-xs h-9 w-full sm:!w-auto sm:min-w-[240px] rounded-lg"
            >
              <option value="">{t('allSources')}</option>
              <option value="manual">{t('sourceTypes.manual')}</option>
              <option value="opening_balance">{t('sourceTypes.opening_balance')}</option>
              <option value="adjustment">{t('sourceTypes.adjustment')}</option>
              <option value="payroll">{t('sourceTypes.payroll')}</option>
              <option value="tax_settlement">{t('sourceTypes.tax_settlement')}</option>
              <option value="initial_import">{t('sourceTypes.initial_import')}</option>
              <option value="sales_invoice">{t('sourceTypes.sales_invoice')}</option>
              <option value="purchase_invoice">{t('sourceTypes.purchase_invoice')}</option>
              <option value="sales_credit_note">{t('sourceTypes.sales_credit_note')}</option>
              <option value="purchase_debit_note">{t('sourceTypes.purchase_debit_note')}</option>
              <option value="payment_entry">{t('sourceTypes.payment_entry')}</option>
              <option value="inventory_receipt">{t('sourceTypes.inventory_receipt')}</option>
              <option value="inventory_dispatch">{t('sourceTypes.inventory_dispatch')}</option>
              <option value="inventory_adjustment">{t('sourceTypes.inventory_adjustment')}</option>
              <option value="fx_revaluation">{t('sourceTypes.fx_revaluation')}</option>
              <option value="year_end_close">{t('sourceTypes.year_end_close')}</option>
            </select>

            <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="input text-xs h-9 px-2 sm:px-3 rounded-lg flex-1 sm:flex-initial sm:w-auto min-w-0"
                title={t('fromDate')}
              />
              <span className="text-[var(--text-muted)] font-bold shrink-0">→</span>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="input text-xs h-9 px-2 sm:px-3 rounded-lg flex-1 sm:flex-initial sm:w-auto min-w-0"
                title={t('toDate')}
              />
            </div>
          </div>
        }
        headerActions={
          <div className="flex items-center gap-2">
            <Button variant="secondary"
              onClick={() => setIsFxRevalOpen(true)}
              className="btn btn-secondary whitespace-nowrap"
            >
              FX Revaluation
            </Button>
            <Button variant="primary"
              onClick={() => router.push('/general-ledger/journal-entries/new')}
              className="px-4 py-2 text-sm font-bold rounded-lg transition-all bg-[#006b5c] text-white hover:brightness-110 whitespace-nowrap shadow-sm"
            >
              {t('newEntry')}
            </Button>
          </div>
        }
      />

      <JournalEntrySlideOver
        entry={selectedEntry}
        onClose={() => setSelectedEntry(null)}
      />

      <FxRevalSlideOver 
        isOpen={isFxRevalOpen}
        onClose={() => setIsFxRevalOpen(false)}
        onSuccess={() => {
          // Trigger reload by slightly changing a dummy filter, or if there's a reload method
          // Right now changing the selected entry clears it, to refresh we could toggle a state.
          // The cleanest way is often router.refresh() in nextjs
          router.refresh();
        }}
      />
    </>
  );
}

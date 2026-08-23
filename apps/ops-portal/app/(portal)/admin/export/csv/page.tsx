'use client';

import React, { useState, useEffect, useMemo, Suspense } from 'react';
import { Button } from '@/components/shared/Button';
import { useSearchParams } from 'next/navigation';
import * as api from '@herobm/sdk';
import { apiFetchBlob, reportError } from '@/lib/api';
import { useTranslations } from 'next-intl';
import { toast } from 'react-hot-toast';
import { getErrorMessage } from '@herobm/shared';

function CsvExportContent() {
  const searchParams = useSearchParams();
  const t = useTranslations('setup.dataExport');

  const [tables, setTables] = useState<
    { id: string; name: string; uniqueKey: string; columns: string[] }[]
  >([]);
  const [selectedTable, setSelectedTable] = useState<string>('');
  const [includeArchived, setIncludeArchived] = useState<boolean>(false);
  const [limit, setLimit] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [showColumns, setShowColumns] = useState<boolean>(false);

  useEffect(() => {
    api
      .setupControllerGetCsvMetadata()
      .then((res) => {
        const arr = res.data;
        const sorted = [...arr].sort((a, b) => a.name.localeCompare(b.name));
        setTables(sorted);
        const urlTable = searchParams?.get('table');
        if (urlTable && sorted.some((t) => t.id === urlTable)) {
          setSelectedTable(urlTable);
        } else if (sorted.length > 0) {
          setSelectedTable(sorted[0].id);
        }
      })
      .catch((err) => {
        reportError(err, 'CsvExportPage.loadMetadata');
        toast.error(t('exportFailed'));
      });
  }, [searchParams, t]);

  const filteredTables = useMemo(() => {
    if (!searchQuery.trim()) return tables;
    const q = searchQuery.toLowerCase().trim();
    return tables.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.id.toLowerCase().includes(q) ||
        t.uniqueKey.toLowerCase().includes(q),
    );
  }, [tables, searchQuery]);

  const activeTable = useMemo(() => {
    return tables.find((t) => t.id === selectedTable);
  }, [tables, selectedTable]);

  const handleExport = async () => {
    if (!selectedTable) return;
    try {
      setIsExporting(true);
      const params = new URLSearchParams();
      if (includeArchived) params.set('includeArchived', 'true');
      if (limit.trim() && !isNaN(Number(limit)) && Number(limit) > 0) {
        params.set('limit', limit.trim());
      }

      const queryStr = params.toString() ? `?${params.toString()}` : '';
      const endpoint = `/api/setup/export-csv/${selectedTable}${queryStr}`;

      const blob = await apiFetchBlob(endpoint);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const dateStr = new Date().toISOString().slice(0, 10);
      a.download = `${selectedTable}_export_${dateStr}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success(t('exportSuccess'));
    } catch (err: unknown) {
      reportError(err, 'CsvExportPage.handleExport');
      toast.error(getErrorMessage(err) || t('exportFailed'));
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col p-8 max-w-3xl mx-auto w-full min-h-[calc(100vh-64px)]">
      <div className="flex flex-col items-center justify-center text-center mb-8">
        <h1 className="text-3xl font-bold text-slate-900 mb-2">{t('title')}</h1>
        <p className="text-slate-500 max-w-xl">{t('subtitle')}</p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-8 shadow-sm">
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-bold text-slate-700">
              {t('targetTable')}
            </label>
            <span className="text-xs text-slate-400 font-medium">
              {t('availableEntities', { count: tables.length })}
            </span>
          </div>

          <div className="mb-3">
            <input
              type="text"
              placeholder={t('searchTables')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:border-[#006b5c] focus:ring-1 focus:ring-[#006b5c] transition-colors"
            />
          </div>

          <div className="max-h-72 overflow-y-auto border border-slate-200 rounded-lg divide-y divide-slate-100 bg-slate-50">
            {filteredTables.map((tbl) => {
              const isSelected = tbl.id === selectedTable;
              return (
                <div
                  key={tbl.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedTable(tbl.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      setSelectedTable(tbl.id);
                    }
                  }}
                  className={`w-full text-left p-3.5 flex items-center justify-between transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-[#f0f9f8] border-l-4 border-l-[#006b5c] font-semibold text-slate-900'
                      : 'hover:bg-slate-100 text-slate-700'
                  }`}
                >
                  <div>
                    <div className="text-sm font-bold text-slate-900">
                      {tbl.name}
                    </div>
                    <div className="text-xs text-slate-500 font-mono mt-0.5">
                      {tbl.id}
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="inline-block px-2 py-0.5 text-xs rounded bg-slate-200 text-slate-700 font-mono">
                      Key: {tbl.uniqueKey}
                    </span>
                  </div>
                </div>
              );
            })}
            {filteredTables.length === 0 && (
              <div className="p-4 text-center text-sm text-slate-400">
                No matching entities found
              </div>
            )}
          </div>
        </div>

        {activeTable && (
          <div className="mb-6 bg-slate-50 border border-slate-200 rounded-lg p-4">
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                {t('options')}
              </span>
              <span className="text-xs font-mono text-slate-500">
                {t('columnsCount', { count: activeTable.columns.length })}
              </span>
            </div>

            <div className="flex flex-col gap-3">
              <label className="flex items-center gap-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={includeArchived}
                  onChange={(e) => setIncludeArchived(e.target.checked)}
                  className="w-4 h-4 text-[#006b5c] rounded border-slate-300 focus:ring-[#006b5c]"
                />
                <div>
                  <div className="text-sm font-medium text-slate-800">
                    {t('includeArchived')}
                  </div>
                  <div className="text-xs text-slate-500">
                    {t('includeArchivedDesc')}
                  </div>
                </div>
              </label>

              <div className="pt-2 border-t border-slate-200 flex items-center justify-between">
                <label className="text-xs font-medium text-slate-700">
                  {t('limitLabel')}
                </label>
                <input
                  type="number"
                  min="1"
                  placeholder={t('limitPlaceholder')}
                  value={limit}
                  onChange={(e) => setLimit(e.target.value)}
                  className="w-32 px-2.5 py-1 text-sm rounded border border-slate-200 bg-white focus:outline-none focus:border-[#006b5c]"
                />
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-200">
              <Button
                variant="ghost"
                onClick={() => setShowColumns(!showColumns)}
                className="text-xs text-[#006b5c] hover:underline font-medium flex items-center gap-1 p-0 h-auto"
              >
                <svg
                  className={`w-3.5 h-3.5 transition-transform ${
                    showColumns ? 'rotate-180' : ''
                  }`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
                {t('columnsPreview')} ({activeTable.columns.length})
              </Button>

              {showColumns && (
                <div className="mt-2 p-2.5 bg-white border border-slate-200 rounded max-h-36 overflow-y-auto text-xs font-mono text-slate-600 flex flex-wrap gap-1.5 animate-in fade-in">
                  {activeTable.columns.map((col) => (
                    <span
                      key={col}
                      className="px-1.5 py-0.5 bg-slate-100 rounded text-slate-700"
                    >
                      {col}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        <div className="pt-4 border-t border-slate-100">
          <Button
            variant="secondary"
            onClick={handleExport}
            disabled={!selectedTable || isExporting}
            className="w-full bg-[#006b5c] hover:bg-[#005246] disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-3 rounded-lg font-bold transition-colors flex items-center justify-center gap-2"
          >
            {isExporting ? (
              <>
                <svg
                  className="animate-spin h-5 w-5 text-white"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8v8H4z"
                  ></path>
                </svg>
                {t('downloading')}
              </>
            ) : (
              <>
                <svg
                  className="w-5 h-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                  />
                </svg>
                {t('downloadCsv')}
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function CsvExportPage() {
  return (
    <Suspense
      fallback={
        <div className="flex-1 flex items-center justify-center p-8 text-slate-400">
          Loading...
        </div>
      }
    >
      <CsvExportContent />
    </Suspense>
  );
}

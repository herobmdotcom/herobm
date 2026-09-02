'use client';

import React, { useState, useEffect, useMemo, Suspense } from 'react';
import { Button } from '@/components/shared/Button';
import { useSearchParams } from 'next/navigation';
import * as api from '@herobm/sdk';
import { reportError } from '@/lib/api';
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
      const parsedLimit = limit.trim() && !isNaN(Number(limit)) && Number(limit) > 0 ? Number(limit.trim()) : undefined;

      const res = await api.setupControllerExportCsv(selectedTable, {
        includeArchived: includeArchived || undefined,
        limit: parsedLimit,
      });

      const csvData = typeof res.data === 'string' ? res.data : String(res.data || '');
      const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
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
        <h1 className="text-3xl font-bold text-[var(--text-primary)] mb-2">{t('title')}</h1>
        <p className="text-[var(--text-muted)] max-w-xl">{t('subtitle')}</p>
      </div>

      <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] p-8 shadow-sm">
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-bold text-[var(--text-primary)]">
              {t('targetTable')}
            </label>
            <span className="text-xs text-[var(--text-muted)] font-medium">
              {t('availableEntities', { count: tables.length })}
            </span>
          </div>

          <div className="mb-3">
            <input
              type="text"
              placeholder={t('searchTables')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input w-full"
            />
          </div>

          <div className="max-h-72 overflow-y-auto border border-[var(--border)] rounded-lg divide-y divide-[var(--border)] bg-[var(--bg-secondary)]">
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
                      ? 'bg-[var(--accent)]/15 border-l-4 border-l-[var(--accent)] font-semibold text-[var(--text-primary)]'
                      : 'hover:bg-[var(--bg-card-hover)] text-[var(--text-secondary)]'
                  }`}
                >
                  <div>
                    <div className="text-sm font-bold text-[var(--text-primary)]">
                      {tbl.name}
                    </div>
                    <div className="text-xs text-[var(--text-muted)] font-mono mt-0.5">
                      {tbl.id}
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="inline-block px-2 py-0.5 text-xs rounded bg-[var(--bg-card)] border border-[var(--border)] text-[var(--text-secondary)] font-mono">
                      Key: {tbl.uniqueKey}
                    </span>
                  </div>
                </div>
              );
            })}
            {filteredTables.length === 0 && (
              <div className="p-4 text-center text-sm text-[var(--text-muted)]">
                No matching entities found
              </div>
            )}
          </div>
        </div>

        {activeTable && (
          <div className="mb-6 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg p-4">
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                {t('options')}
              </span>
              <span className="text-xs font-mono text-[var(--text-muted)]">
                {t('columnsCount', { count: activeTable.columns.length })}
              </span>
            </div>

            <div className="flex flex-col gap-3">
              <label className="flex items-center gap-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={includeArchived}
                  onChange={(e) => setIncludeArchived(e.target.checked)}
                  className="checkbox checkbox-sm checkbox-primary"
                />
                <div>
                  <div className="text-sm font-medium text-[var(--text-primary)]">
                    {t('includeArchived')}
                  </div>
                  <div className="text-xs text-[var(--text-muted)]">
                    {t('includeArchivedDesc')}
                  </div>
                </div>
              </label>

              <div className="pt-2 border-t border-[var(--border)] flex items-center justify-between">
                <label className="text-xs font-medium text-[var(--text-secondary)]">
                  {t('limitLabel')}
                </label>
                <input
                  type="number"
                  min="1"
                  placeholder={t('limitPlaceholder')}
                  value={limit}
                  onChange={(e) => setLimit(e.target.value)}
                  className="input w-32 text-sm"
                />
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-[var(--border)]">
              <Button
                variant="ghost"
                onClick={() => setShowColumns(!showColumns)}
                className="text-xs text-[var(--accent)] hover:underline font-medium flex items-center gap-1 p-0 h-auto"
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
                <div className="mt-2 p-2.5 bg-[var(--bg-card)] border border-[var(--border)] rounded max-h-36 overflow-y-auto text-xs font-mono text-[var(--text-secondary)] flex flex-wrap gap-1.5 animate-in fade-in">
                  {activeTable.columns.map((col) => (
                    <span
                      key={col}
                      className="px-1.5 py-0.5 bg-[var(--bg-secondary)] border border-[var(--border)] rounded text-[var(--text-primary)]"
                    >
                      {col}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        <div className="pt-4 border-t border-[var(--border)]">
          <Button
            variant="primary"
            onClick={handleExport}
            disabled={!selectedTable || isExporting}
            className="w-full btn btn-primary px-6 py-3 rounded-lg font-bold transition-colors flex items-center justify-center gap-2"
          >
            {isExporting ? (
              <>
                <svg
                  className="animate-spin h-5 w-5 text-current"
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

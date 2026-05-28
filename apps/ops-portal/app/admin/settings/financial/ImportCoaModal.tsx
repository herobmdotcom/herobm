'use client';
import { useState, useEffect } from 'react';
import SlideOver from '@/components/shared/SlideOver';
import { useTranslations } from 'next-intl';
import * as api from '@modbm/sdk';
import { toast } from 'react-hot-toast';

interface ChartFile {
  filename: string;
  name: string;
  countryCode?: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete: () => void;
}

export default function ImportCoaModal({ isOpen, onClose, onImportComplete }: Props) {
  const tCommon = useTranslations('common');
  const tSettings = useTranslations('admin.settings');
  const [charts, setCharts] = useState<ChartFile[]>([]);
  const [selectedFile, setSelectedFile] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadCharts();
    }
  }, [isOpen]);

  const loadCharts = async () => {
    try {
      setIsLoading(true);
      const res = await api.glControllerListCharts();
      const data = (res as unknown as { data: any[] })?.data || (res as unknown as any[]) || [];
      setCharts(data);
      if (data.length > 0) {
        setSelectedFile(data[0].filename);
      }
    } catch (err: any) {
      toast.error('Failed to load available charts: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleImport = async () => {
    if (!selectedFile) return;
    try {
      setIsImporting(true);
      const res = await api.glControllerSeedChartOfAccounts({ filename: selectedFile });
      const data = (res as unknown as { data: any })?.data || (res as unknown as any) || {};
      toast.success(`Successfully imported ${data.created} accounts.`);
      onImportComplete();
      onClose();
    } catch (err: any) {
      toast.error('Failed to import chart of accounts: ' + err.message);
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <SlideOver isOpen={isOpen} onClose={onClose} title="Import Chart of Accounts" width="max-w-md">
      <div className="flex flex-col gap-4 p-4">
        {isLoading ? (
          <div className="text-sm text-muted animate-pulse">{tSettings('importCoaModal.loadingCharts')}</div>
        ) : charts.length === 0 ? (
          <div className="text-sm text-muted">{tSettings('importCoaModal.noCharts')}</div>
        ) : (
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium">{tSettings('importCoaModal.selectPreset')}</label>
            <select
              className="input w-full"
              value={selectedFile}
              onChange={(e) => setSelectedFile(e.target.value)}
              disabled={isImporting}
            >
              {charts.map((chart) => (
                <option key={chart.filename} value={chart.filename}>
                  {chart.name} {chart.countryCode ? `(${chart.countryCode})` : ''}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="flex justify-end gap-2 mt-4">
          <button className="btn btn-secondary" onClick={onClose} disabled={isImporting}>
            {tCommon('cancel')}
          </button>
          <button
            className="btn btn-primary"
            onClick={handleImport}
            disabled={!selectedFile || isImporting || isLoading}
          >
            {isImporting ? tSettings('importCoaModal.importing') : tSettings('importCoaModal.importAction')}
          </button>
        </div>
      </div>
    </SlideOver>
  );
}

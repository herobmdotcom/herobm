'use client';
import { useState, useEffect } from 'react';
import SlideOver from '@/components/shared/SlideOver';
import { useTranslations } from 'next-intl';
import * as api from '@modbm/sdk';
import { getErrorMessage } from '@modbm/shared';
import { toast } from 'react-hot-toast';

interface SettingsFile {
  filename: string;
  name: string;
  countryCode?: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete: () => void;
}

export default function ImportTaxModal({ isOpen, onClose, onImportComplete }: Props) {
  const tCommon = useTranslations('common');
  const tSettings = useTranslations('admin.settings');
  const [files, setFiles] = useState<SettingsFile[]>([]);
  const [selectedFile, setSelectedFile] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadFiles();
    }
  }, [isOpen]);

  const loadFiles = async () => {
    try {
      setIsLoading(true);
      const res = await api.glControllerListTaxSettingsFiles();
      const data = res.data as unknown as SettingsFile[];
      setFiles(data);
      if (data?.length > 0) {
        setSelectedFile(data[0].filename);
      }
    } catch (err: unknown) {
      toast.error('Failed to load available tax settings: ' + getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  const handleImport = async () => {
    if (!selectedFile) return;
    try {
      setIsImporting(true);
      const res = await api.glControllerSeedTaxSettings({ filename: selectedFile });
      const data = res.data;
      toast.success(`Successfully imported ${(data as unknown as { created?: number })?.created || 0} tax categories.`);
      onImportComplete();
      onClose();
    } catch (err: unknown) {
      toast.error('Failed to import tax settings: ' + getErrorMessage(err));
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <SlideOver isOpen={isOpen} onClose={onClose} title="Import Tax Settings" width="max-w-md">
      <div className="flex flex-col gap-4 p-4">
        {isLoading ? (
          <div className="text-sm text-muted animate-pulse">{tSettings('importTaxModal.loadingCharts')}</div>
        ) : files.length === 0 ? (
          <div className="text-sm text-muted">{tSettings('importTaxModal.noCharts')}</div>
        ) : (
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium">{tSettings('importTaxModal.selectPreset')}</label>
            <select
              className="input w-full"
              value={selectedFile}
              onChange={(e) => setSelectedFile(e.target.value)}
              disabled={isImporting}
            >
              {files.map((file) => (
                <option key={file.filename} value={file.filename}>
                  {file.name} {file.countryCode ? `(${file.countryCode})` : ''}
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
            {isImporting ? tSettings('importTaxModal.importing') : tSettings('importTaxModal.importAction')}
          </button>
        </div>
      </div>
    </SlideOver>
  );
}

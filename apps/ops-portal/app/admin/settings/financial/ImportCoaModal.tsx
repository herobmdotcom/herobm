'use client';
import { useState, useEffect, useRef } from 'react';
import SlideOver from '@/components/shared/SlideOver';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/shared/Button';
import * as api from '@herobm/sdk';
import { getErrorMessage } from '@herobm/shared';
import { toast } from 'react-hot-toast';

interface ChartFile {
  filename: string;
  name: string;
  countryCode?: string;
}

interface ParsedCoaMeta {
  name: string;
  countryCode?: string;
  accountCount: number;
}

interface CoaTreeNode {
  children?: Record<string, CoaTreeNode>;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete: () => void;
}

export default function ImportCoaModal({ isOpen, onClose, onImportComplete }: Props) {
  const tSettings = useTranslations('admin.settings');
  const [charts, setCharts] = useState<ChartFile[]>([]);
  const [selectedFile, setSelectedFile] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  // Upload state
  const [uploadedData, setUploadedData] = useState<Record<string, unknown> | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string>('');
  const [uploadedMeta, setUploadedMeta] = useState<ParsedCoaMeta | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      loadCharts();
      setUploadedData(null);
      setUploadedFileName('');
      setUploadedMeta(null);
    }
  }, [isOpen]);

  const loadCharts = async () => {
    try {
      setIsLoading(true);
      const res = await api.glControllerListCharts();
      const data = res.data as unknown as ChartFile[];
      setCharts(data);
      if (data?.length > 0) {
        setSelectedFile(data[0].filename);
      }
    } catch (err: unknown) {
      toast.error(tSettings('importCoaModal.loadChartsFailed', { error: getErrorMessage(err) }));
    } finally {
      setIsLoading(false);
    }
  };

  const countNodes = (tree: Record<string, CoaTreeNode>): number => {
    let total = 0;
    for (const key of Object.keys(tree || {})) {
      total++;
      const node = tree[key];
      if (node?.children) {
        total += countNodes(node.children);
      }
    }
    return total;
  };

  const processFile = (file: File) => {
    if (!file.name.endsWith('.json')) {
      toast.error(tSettings('importCoaModal.invalidFile'));
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const parsed = JSON.parse(text);
        if (!parsed || typeof parsed !== 'object' || !parsed.tree || typeof parsed.tree !== 'object') {
          toast.error(tSettings('importCoaModal.invalidFile'));
          return;
        }
        setUploadedData(parsed);
        setUploadedFileName(file.name);
        setUploadedMeta({
          name: parsed.name || file.name.replace('.json', ''),
          countryCode: parsed.country_code,
          accountCount: countNodes(parsed.tree),
        });
        toast.success(tSettings('importCoaModal.fileLoaded'));
      } catch (err: unknown) {
        toast.error(tSettings('importCoaModal.invalidFile') + ': ' + getErrorMessage(err));
      }
    };
    reader.readAsText(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleImportUploaded = async () => {
    if (!uploadedData) return;
    try {
      setIsImporting(true);
      const res = await api.glControllerSeedChartOfAccounts({ data: uploadedData });
      const data = res.data;
      toast.success(tSettings('importCoaModal.importSuccess', { count: (data as unknown as { created?: number })?.created || 0 }));
      onImportComplete();
      onClose();
    } catch (err: unknown) {
      toast.error(tSettings('importCoaModal.importFailed', { error: getErrorMessage(err) }));
    } finally {
      setIsImporting(false);
    }
  };

  const handleImportPreset = async () => {
    if (!selectedFile) return;
    try {
      setIsImporting(true);
      const res = await api.glControllerSeedChartOfAccounts({ filename: selectedFile });
      const data = res.data;
      toast.success(tSettings('importCoaModal.importSuccess', { count: (data as unknown as { created?: number })?.created || 0 }));
      onImportComplete();
      onClose();
    } catch (err: unknown) {
      toast.error(tSettings('importCoaModal.importFailed', { error: getErrorMessage(err) }));
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <SlideOver isOpen={isOpen} onClose={onClose} title={tSettings('importCoaModal.title')} width="max-w-md">
      <div className="flex flex-col gap-6 p-4">
        {/* Section 1: Upload */}
        <div className="flex flex-col gap-3">
          <h4 className="text-sm font-semibold text-foreground">
            {tSettings('importCoaModal.uploadSection')}
          </h4>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleFileChange}
            className="hidden"
            disabled={isImporting}
          />
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-lg p-5 flex flex-col items-center justify-center text-center cursor-pointer transition-colors ${
              isDragging
                ? 'border-[var(--color-primary-500)] bg-[var(--color-primary-50)]/10'
                : 'border-[var(--border-color)] hover:border-[var(--color-primary-400)] bg-[var(--bg-subtle)]'
            }`}
          >
            <span className="material-symbols-outlined text-3xl text-muted mb-1">upload_file</span>
            <p className="text-sm font-medium text-foreground">{tSettings('importCoaModal.browseFile')}</p>
            <p className="text-xs text-muted mt-1">{tSettings('importCoaModal.dropFile')}</p>
          </div>

          {uploadedFileName && uploadedMeta ? (
            <div className="p-3 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-md text-xs flex flex-col gap-1">
              <div className="font-semibold text-foreground">{uploadedFileName}</div>
              <div className="text-muted">
                {uploadedMeta.name}
                {uploadedMeta.countryCode ? ` (${uploadedMeta.countryCode})` : ''}
                {' — '}
                {uploadedMeta.accountCount} {tSettings('importCoaModal.accountsLabel')}
              </div>
            </div>
          ) : (
            <div className="text-xs text-muted text-center">{tSettings('importCoaModal.noFileSelected')}</div>
          )}

          <div className="flex justify-end mt-1">
            <Button
              variant="primary"
              onClick={handleImportUploaded}
              disabled={!uploadedData || isImporting}
            >
              {isImporting ? tSettings('importCoaModal.importing') : tSettings('importCoaModal.importAction')}
            </Button>
          </div>
        </div>

        {/* Divider */}
        <div className="relative flex items-center justify-center">
          <div className="border-t border-[var(--border-color)] w-full" />
          <span className="bg-[var(--bg-card)] px-3 text-xs uppercase font-semibold text-muted absolute">
            {tSettings('importCoaModal.orDivider')}
          </span>
        </div>

        {/* Section 2: Preset */}
        <div className="flex flex-col gap-3">
          <h4 className="text-sm font-semibold text-foreground">
            {tSettings('importCoaModal.presetSection')}
          </h4>
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

          <div className="flex justify-end mt-1">
            <Button
              variant="primary"
              onClick={handleImportPreset}
              disabled={!selectedFile || isImporting || isLoading}
            >
              {isImporting ? tSettings('importCoaModal.importing') : tSettings('importCoaModal.importAction')}
            </Button>
          </div>
        </div>
      </div>
    </SlideOver>
  );
}

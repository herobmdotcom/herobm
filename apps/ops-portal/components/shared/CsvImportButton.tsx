'use client';

import { useRef } from 'react';
import { useTranslations } from 'next-intl';

interface CsvImportButtonProps {
  onImport: (data: any[]) => void;
  className?: string;
  disabled?: boolean;
}

export default function CsvImportButton({ onImport, className, disabled }: CsvImportButtonProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const t = useTranslations('admin.settings');

  const handleButtonClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (!text) return;

      const lines = text.split(/\r?\n/).filter(line => line.trim());
      if (lines.length < 2) return;

      // Extract headers from first line
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
      
      const data = lines.slice(1).map(line => {
        // Simple CSV split (handles basic quotes but not commas inside quotes)
        // For a true "Thin Glass" back-office tool, we might want a library later, 
        // but for settings import, simple split is usually sufficient or users can avoid commas.
        const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
        const obj: any = {};
        headers.forEach((h, i) => {
          obj[h] = values[i];
        });
        return obj;
      });

      onImport(data);
      // Reset input so the same file can be selected again if needed
      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsText(file);
  };

  return (
    <>
      <button 
        className={className || "btn btn-secondary btn-sm"} 
        onClick={handleButtonClick}
        disabled={disabled}
        type="button"
      >
        {t('actions.importCsv')}
      </button>
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept=".csv"
        className="hidden"
      />
    </>
  );
}

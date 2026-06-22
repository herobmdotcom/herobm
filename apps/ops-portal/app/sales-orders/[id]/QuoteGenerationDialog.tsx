'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import * as api from '@herobm/sdk';
import { getErrorMessage } from '@herobm/shared';


interface Macro {
  macroId: string;
  name: string;
  macroType: string;
  content: string;
}

interface QuoteGenerationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onGenerate: (text: string) => Promise<void>;
}

export default function QuoteGenerationDialog({ isOpen, onClose, onGenerate }: QuoteGenerationDialogProps) {
  const t = useTranslations('salesOrders');
  const tCommon = useTranslations('common');
  const tSettings = useTranslations('admin.settings');

  const [macros, setMacros] = useState<Macro[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedMacroId, setSelectedMacroId] = useState<string>('');
  const [customText, setCustomText] = useState('');
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadMacros();
      setSelectedMacroId('');
      setCustomText('');
      setError(null);
    }
  }, [isOpen]);

  const loadMacros = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.macrosControllerFindAll({ macroType: 'text_template' } );
      const data = res.data;
      const textMacros = data.filter((m: Macro) => m.macroType === 'text_template') as Macro[];
      setMacros(textMacros);
    } catch (err: unknown) {
      setError(getErrorMessage(err) || 'Failed to load macros');
    } finally {
      setLoading(false);
    }
  };

  const handleMacroChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value;
    setSelectedMacroId(id);
    const macro = macros.find(m => m.macroId === id);
    if (macro) {
      setCustomText(macro.content);
    }
  };

  const handleGenerate = async () => {
    setGenerating(true);
    setError(null);
    try {
      await onGenerate(customText);
      onClose();
    } catch (err: unknown) {
      setError(getErrorMessage(err) || 'Failed to generate quote');
    } finally {
      setGenerating(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-md flex flex-col overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
          <h2 className="text-xl font-bold text-gray-900">{t('generateQuoteTitle')}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            {/* eslint-disable-next-line i18next/no-literal-string -- Hardcoded string exceptions for standard system IDs, technical constants, or non-translatable symbols (e.g., -- Material UI Icon). */}
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        
        <div className="p-6 flex flex-col gap-4">
          {error && (
            <div className="p-3 rounded bg-red-50 text-red-700 text-sm border border-red-200">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-1 text-gray-700">
              {t('labels.quoteMacro')}
            </label>
            {loading ? (
              <div className="text-sm text-gray-500">{tCommon('loading')}</div>
            ) : (
              <select
                className="input w-full"
                value={selectedMacroId}
                onChange={handleMacroChange}
              >
                <option value="">{t('placeholders.selectMacro')}</option>
                {macros.map(m => (
                  <option key={m.macroId} value={m.macroId}>
                    {m.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1 text-gray-700">
              {t('labels.quoteText')}
            </label>
            <textarea
              className="input w-full font-sans text-sm"
              rows={6}
              value={customText}
              onChange={(e) => setCustomText(e.target.value)}
              placeholder={t('placeholders.quoteText') || 'Enter text to display on the quote PDF...'}
            />
          </div>

          <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-gray-100">
            <button
              className="btn btn-secondary"
              onClick={onClose}
              disabled={generating}
            >
              {tCommon('cancel')}
            </button>
            <button
              className="btn btn-primary flex items-center gap-2"
              onClick={handleGenerate}
              disabled={generating}
            >
              {generating && (
                <>
                  { }
                  <span className="material-symbols-outlined animate-spin text-sm">progress_activity</span>
                </>
              )}
              {t('buttons.generate')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

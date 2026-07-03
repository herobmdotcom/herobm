'use client';

import React, { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
// eslint-disable-next-line no-restricted-imports -- External API integration boundaries where exact types are unknown.
import { getToken, apiFetch, reportError } from '@/lib/api';
import * as api from '@herobm/sdk';
import { Button } from '@/components/shared/Button';

function getExcelColumnName(colIndex: string): string {
  const num = parseInt(colIndex, 10);
  if (isNaN(num) || num.toString() !== colIndex) return colIndex;
  
  let temp = num;
  let letter = '';
  while (temp >= 0) {
    letter = String.fromCharCode((temp % 26) + 65) + letter;
    temp = Math.floor(temp / 26) - 1;
  }
  return letter;
}

interface BankImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  fixedGlAccountId?: string;
}

export default function BankImportModal({ isOpen, onClose, onSuccess, fixedGlAccountId }: BankImportModalProps) {
  const t = useTranslations('gl.reconciliations');
  const tCommon = useTranslations('common');
  const [step, setStep] = useState(1);
  const [file, setFile] = useState<File | null>(null);
  const [glAccountId, setGlAccountId] = useState('');
  const [bankAccounts, setBankAccounts] = useState<api.GlAccountResponseDto[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [profiles, setProfiles] = useState<api.MappingProfileResponseDto[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState('');
  
  // profile mapping state
  const [name, setName] = useState('');
  const [dateColumn, setDateColumn] = useState('');
  const [amountColumn, setAmountColumn] = useState('');
  const [descriptionColumn, setDescriptionColumn] = useState('');
  const [referenceColumn, setReferenceColumn] = useState('');
  const [headerRows, setHeaderRows] = useState(1);
  
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<{ autoMatchedCount: number, unmatchedCount: number } | null>(null);

  useEffect(() => {
    if (isOpen) {
      if (fixedGlAccountId) {
        setGlAccountId(fixedGlAccountId);
      } else {
        // fetch bank accounts
        api.glControllerGetAccounts({ isBankAccount: 'true' })
          .then(res => setBankAccounts(Array.isArray(res.data) ? (res.data as unknown as api.GlAccountResponseDto[]) : (((res.data as unknown as { items: unknown[] }).items as unknown as api.GlAccountResponseDto[]) || [])))
          .catch(console.error);
      }
    } else {
      // reset state when closed
      setStep(1);
      setFile(null);
      setResults(null);
      setSelectedProfileId('');
      if (!fixedGlAccountId) setGlAccountId('');
    }
  }, [isOpen, fixedGlAccountId]);

  useEffect(() => {
    api.bankFeedsControllerGetProfiles().then(res => setProfiles(res.data)).catch(console.error);
  }, []);

  if (!isOpen) return null;

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleParse = async () => {
    if (!file || !glAccountId) return;
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const res = await apiFetch<{ headers: Record<string, unknown> }>('/api/gl/bank-feeds/parse', {
        method: 'POST',
        body: formData,
      });
      
      setHeaders(Object.keys(res.headers));
      setStep(2);
    } catch (err) {
      reportError(err);
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    setLoading(true);
    try {
      let finalProfileId = selectedProfileId;
      if (!selectedProfileId) {
        // create new profile
        const profileRes = await api.bankFeedsControllerCreateProfile({
          name: name || 'New Profile',
          dateColumn,
          amountColumn,
          descriptionColumn,
          referenceColumn: referenceColumn || undefined,
          headerRows
        });
        finalProfileId = profileRes.data.profileId;
      }

      const formData = new FormData();
      formData.append('file', file as File);
      formData.append('glAccountId', glAccountId);
      formData.append('profileId', finalProfileId);
      
      const res = await apiFetch<{ autoMatchedCount: number; unmatchedCount: number }>('/api/gl/bank-feeds/import', {
        method: 'POST',
        body: formData,
      });

      setResults(res);
      setStep(3);
    } catch (err) {
      reportError(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-[var(--bg-card)] rounded-lg w-full max-w-2xl border border-[var(--border)] overflow-hidden flex flex-col max-h-[90vh]">
        <div className="px-6 py-4 border-b border-[var(--border)] bg-[var(--bg-secondary)] flex justify-between items-center shrink-0">
          <h2 className="text-xl font-bold text-[var(--text-primary)]">{t('importBankStatement')}</h2>
          <Button variant="ghost" onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
            {/* eslint-disable-next-line i18next/no-literal-string -- Hardcoded string exceptions for standard system IDs, technical constants, or non-translatable symbols. */}
            <span>✕</span>
          </Button>
        </div>
        
        <div className="p-6 overflow-y-auto flex-1 text-[var(--text-primary)]">
          {step === 1 && (
            <div className="space-y-4">
              {!fixedGlAccountId && (
                <div>
                  <label className="block text-sm font-medium text-[var(--text-muted)] mb-1">{t('bankAccount')}</label>
                  <select className="input w-full" value={glAccountId} onChange={e => setGlAccountId(e.target.value)}>
                    <option value="">{t('selectAccount')}</option>
                    {bankAccounts.map(a => <option key={a.glAccountId} value={a.glAccountId}>{a.accountCode} - {a.name}</option>)}
                  </select>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-[var(--text-muted)] mb-1">{t('csvFile')}</label>
                <div className="flex items-center gap-4">
                  <Button type="button" variant="secondary" onClick={() => document.getElementById('csv-upload')?.click()}>
                    {t('chooseFile')}
                  </Button>
                  <span className="text-sm text-[var(--text-muted)]">{file ? file.name : t('noFileSelected')}</span>
                  <input id="csv-upload" type="file" accept=".csv" onChange={handleFileUpload} className="hidden" />
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              {profiles.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-[var(--text-muted)] mb-1">{t('savedProfile')}</label>
                  <select className="input w-full" value={selectedProfileId} onChange={e => setSelectedProfileId(e.target.value)}>
                    <option value="">{t('createNewProfile')}</option>
                    {profiles.map(p => <option key={p.profileId} value={p.profileId}>{p.name}</option>)}
                  </select>
                </div>
              )}

              {!selectedProfileId && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-[var(--text-muted)] mb-1">{t('profileName')}</label>
                    <input type="text" value={name} onChange={e => setName(e.target.value)} className="input w-full" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[var(--text-muted)] mb-1">{t('dateColumn')}</label>
                    <select className="input w-full" value={dateColumn} onChange={e => setDateColumn(e.target.value)}>
                      <option value="">Select...</option>
                      {headers.map(h => <option key={h} value={h}>{getExcelColumnName(h)}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[var(--text-muted)] mb-1">{t('amountColumn')}</label>
                    <select className="input w-full" value={amountColumn} onChange={e => setAmountColumn(e.target.value)}>
                      <option value="">Select...</option>
                      {headers.map(h => <option key={h} value={h}>{getExcelColumnName(h)}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[var(--text-muted)] mb-1">{t('descriptionColumn')}</label>
                    <select className="input w-full" value={descriptionColumn} onChange={e => setDescriptionColumn(e.target.value)}>
                      <option value="">Select...</option>
                      {headers.map(h => <option key={h} value={h}>{getExcelColumnName(h)}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[var(--text-muted)] mb-1">{t('referenceColumn')}</label>
                    <select className="input w-full" value={referenceColumn} onChange={e => setReferenceColumn(e.target.value)}>
                      <option value="">{t('none')}</option>
                      {headers.map(h => <option key={h} value={h}>{getExcelColumnName(h)}</option>)}
                    </select>
                  </div>
                </div>
              )}
            </div>
          )}

          {step === 3 && results && (
            <div className="space-y-4 text-center py-6">
              <div className="flex justify-center items-center gap-2 mb-2">
                { }
                <span className="material-symbols-outlined text-[24px] text-[var(--success)]">check_circle</span>
                <h3 className="text-lg font-bold text-[var(--text-primary)]">{t('importComplete')}</h3>
              </div>
              <div className="text-[var(--text-muted)]">
                <p>{t('linesAutoReconciled', { count: results.autoMatchedCount })}</p>
                <p>{t('linesQueued', { count: results.unmatchedCount })}</p>
              </div>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-[var(--border)] bg-[var(--bg-secondary)] flex justify-end gap-3 shrink-0">
          {step < 3 && (
            <Button variant="secondary" onClick={onClose}>
              {tCommon('cancel')}
            </Button>
          )}
          
          {step === 1 && (
            <Button variant="primary" onClick={handleParse} disabled={!file || !glAccountId || loading}>
              {loading ? t('parsing') : t('next')}
            </Button>
          )}

          {step === 2 && (
            <Button variant="primary" onClick={handleImport} disabled={loading}>
              {loading ? t('importing') : t('import')}
            </Button>
          )}

          {step === 3 && (
            <Button variant="primary" onClick={() => { onClose(); onSuccess(); }}>
              {t('done')}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

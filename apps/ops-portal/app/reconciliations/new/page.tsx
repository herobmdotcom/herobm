'use client';

import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { useRouter } from 'next/navigation';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
// eslint-disable-next-line no-restricted-imports -- External API integration boundaries where exact types are unknown.
import { reportError, apiFetch } from '@/lib/api';
import * as api from '@herobm/sdk';
import { useTranslations } from 'next-intl';
import { getErrorMessage } from '@herobm/shared';
import { Button } from '@/components/shared/Button';

export default function NewReconciliationPage() {
  const t = useTranslations('gl.reconciliations');
  const tCommon = useTranslations('common');
  useDocumentTitle(t('newReconciliation'));
  const router = useRouter();
  
  const [glAccountId, setGlAccountId] = useState('');
  const [statementDate, setStatementDate] = useState('');
  const [statementBalance, setStatementBalance] = useState('');
  const [accounts, setAccounts] = useState<api.GlAccountResponseDto[]>([]);
  const [profiles, setProfiles] = useState<api.MappingProfileResponseDto[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState('');
  const [file, setFile] = useState<File | null>(null);
  
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function fetchData() {
      try {
        const [accRes, profRes] = await Promise.all([
          api.glControllerGetAccounts({ isBankAccount: 'true' }),
          api.bankFeedsControllerGetProfiles()
        ]);
        setAccounts(accRes.data as unknown as api.GlAccountResponseDto[]);
        setProfiles(profRes.data || []);
      } catch (err) {
        toast.error('Failed to load accounts: ' + getErrorMessage(err));
        reportError(err, 'NewReconciliationFetch');
      }
    }
    fetchData();
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await api.reconciliationControllerCreateReconciliation({
        glAccountId,
        statementDate,
        statementBalance: Number(statementBalance),
        createdBy: 'System User', // Hardcoded for now
      });
      const data = res.data;
      
      // If a file and profile are selected, import the CSV
      if (file && selectedProfileId) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('glAccountId', glAccountId);
        formData.append('profileId', selectedProfileId);
        
        await apiFetch<unknown>('/api/gl/bank-feeds/import', {
          method: 'POST',
          body: formData,
        });
      }
      
      router.push(`/reconciliations/${data.reconciliationId}`);
    } catch (err) {
      reportError(err, 'NewReconciliationSubmit');
      alert(t('createError'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 max-w-2xl mx-auto h-[calc(100vh-64px)] flex flex-col">
      <h1 className="text-2xl font-semibold text-[var(--text-primary)] mb-6">{t('newReconciliation')}</h1>

      <div className="bg-white border border-[var(--border)] rounded-md p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                {t('glAccount')}
              </label>
              <select
                value={glAccountId}
                onChange={(e) => setGlAccountId(e.target.value)}
                required
                className="input w-full bg-white"
              >
                <option value="">{t('selectAccount')}</option>
                {Array.isArray(accounts) && accounts.map(acc => (
                  <option key={acc.glAccountId} value={acc.glAccountId}>
                    {acc.accountCode} - {acc.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                {t('statementDate')}
              </label>
              <input
                type="date"
                value={statementDate}
                onChange={(e) => setStatementDate(e.target.value)}
                required
                className="input w-full bg-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                {t('statementBalance')}
              </label>
              <input
                type="number"
                step="0.01"
                value={statementBalance}
                onChange={(e) => setStatementBalance(e.target.value)}
                required
                className="input w-full bg-white"
              />
            </div>
          </div>
          
          <hr className="border-[var(--border)]" />
          
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">{t('importStatementFromCsvOptional')}</h3>
            <div>
              <div className="flex items-center gap-4">
                <Button type="button" variant="secondary" onClick={() => document.getElementById('csv-upload')?.click()}>
                  {t('chooseFile')}
                </Button>
                <span className="text-sm text-[var(--text-muted)]">{file ? file.name : t('noFileSelected')}</span>
                <input id="csv-upload" type="file" accept=".csv" onChange={handleFileUpload} className="hidden" />
              </div>
            </div>
            
            {file && (
              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">{t('savedProfile')}</label>
                <select className="input w-full bg-white" value={selectedProfileId} onChange={e => setSelectedProfileId(e.target.value)} required={!!file}>
                  <option value="">{t('selectProfile')}</option>
                  {profiles.map(p => <option key={p.profileId} value={p.profileId}>{p.name}</option>)}
                </select>
              </div>
            )}
          </div>

          <div className="pt-4 flex justify-end gap-3">
            <Button variant="secondary"
              type="button"
              onClick={() => router.back()}
              className="px-4 py-2 border border-[var(--border)] text-[var(--text-secondary)] rounded-md hover:bg-gray-50 transition-colors text-sm font-medium"
            >
              {tCommon('cancel')}
            </Button>
            <Button variant="primary"
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-[var(--accent)] text-white rounded-md hover:brightness-110 font-medium transition-all text-sm disabled:opacity-50"
            >
              {loading ? tCommon('loading') : t('create')}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

'use client';

import React, { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { getToken, apiFetch, apiMutate } from '@/lib/api';

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
}

export default function BankImportModal({ isOpen, onClose, onSuccess }: BankImportModalProps) {
  const t = useTranslations('gl.reconciliations');
  const [step, setStep] = useState(1);
  const [file, setFile] = useState<File | null>(null);
  const [glAccountId, setGlAccountId] = useState('');
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
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
      // fetch bank accounts
      apiFetch<any>('/api/gl/accounts?isBankAccount=true')
        .then(res => setBankAccounts(Array.isArray(res) ? res : res.items || []))
        .catch(console.error);
    } else {
      // reset state when closed
      setStep(1);
      setFile(null);
      setResults(null);
      setSelectedProfileId('');
    }
  }, [isOpen]);

  useEffect(() => {
    if (glAccountId) {
      apiFetch<any[]>(`/api/gl/bank-feeds/profiles/${glAccountId}`).then(res => setProfiles(res)).catch(console.error);
    }
  }, [glAccountId]);

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
      
      const res = await fetch('/api/gl/bank-feeds/parse', {
        method: 'POST',
        headers: { Authorization: `Bearer ${getToken()}` },
        body: formData,
      });
      
      if (!res.ok) throw new Error('Failed to parse CSV');
      const data = await res.json();
      setHeaders(Object.keys(data.headers));
      setStep(2);
    } catch (err) {
      console.error(err);
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
        const profileRes = await apiMutate<any>('/api/gl/bank-feeds/profiles', 'POST', {
          glAccountId,
          name: name || 'New Profile',
          dateColumn,
          amountColumn,
          descriptionColumn,
          referenceColumn: referenceColumn || undefined,
          headerRows
        });
        finalProfileId = profileRes.profileId;
      }

      const formData = new FormData();
      formData.append('file', file as File);
      formData.append('glAccountId', glAccountId);
      formData.append('profileId', finalProfileId);
      
      const res = await fetch('/api/gl/bank-feeds/import', {
        method: 'POST',
        headers: { Authorization: `Bearer ${getToken()}` },
        body: formData,
      });

      if (!res.ok) throw new Error('Failed to import CSV');
      const data = await res.json();

      setResults(data);
      setStep(3);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-[var(--bg-card)] rounded-lg shadow-xl w-full max-w-2xl border border-[var(--border)] overflow-hidden flex flex-col max-h-[90vh]">
        <div className="px-6 py-4 border-b border-[var(--border)] bg-[var(--bg-secondary)] flex justify-between items-center shrink-0">
          <h2 className="text-xl font-bold text-[var(--text-primary)]">Import Bank Statement</h2>
          <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">✕</button>
        </div>
        
        <div className="p-6 overflow-y-auto flex-1 text-[var(--text-primary)]">
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[var(--text-muted)] mb-1">Bank Account</label>
                <select className="input w-full" value={glAccountId} onChange={e => setGlAccountId(e.target.value)}>
                  <option value="">Select an account...</option>
                  {bankAccounts.map(a => <option key={a.glAccountId} value={a.glAccountId}>{a.accountCode} - {a.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--text-muted)] mb-1">CSV File</label>
                <div className="flex items-center gap-4">
                  <button type="button" className="btn btn-secondary" onClick={() => document.getElementById('csv-upload')?.click()}>
                    Choose File
                  </button>
                  <span className="text-sm text-[var(--text-muted)]">{file ? file.name : 'No file selected'}</span>
                  <input id="csv-upload" type="file" accept=".csv" onChange={handleFileUpload} className="hidden" />
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              {profiles.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-[var(--text-muted)] mb-1">Saved Profile</label>
                  <select className="input w-full" value={selectedProfileId} onChange={e => setSelectedProfileId(e.target.value)}>
                    <option value="">Create new profile...</option>
                    {profiles.map(p => <option key={p.profileId} value={p.profileId}>{p.name}</option>)}
                  </select>
                </div>
              )}

              {!selectedProfileId && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-[var(--text-muted)] mb-1">Profile Name</label>
                    <input type="text" value={name} onChange={e => setName(e.target.value)} className="input w-full" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[var(--text-muted)] mb-1">Date Column</label>
                    <select className="input w-full" value={dateColumn} onChange={e => setDateColumn(e.target.value)}>
                      <option value="">Select...</option>
                      {headers.map(h => <option key={h} value={h}>{getExcelColumnName(h)}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[var(--text-muted)] mb-1">Amount Column</label>
                    <select className="input w-full" value={amountColumn} onChange={e => setAmountColumn(e.target.value)}>
                      <option value="">Select...</option>
                      {headers.map(h => <option key={h} value={h}>{getExcelColumnName(h)}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[var(--text-muted)] mb-1">Description Column</label>
                    <select className="input w-full" value={descriptionColumn} onChange={e => setDescriptionColumn(e.target.value)}>
                      <option value="">Select...</option>
                      {headers.map(h => <option key={h} value={h}>{getExcelColumnName(h)}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[var(--text-muted)] mb-1">Reference Column (Optional)</label>
                    <select className="input w-full" value={referenceColumn} onChange={e => setReferenceColumn(e.target.value)}>
                      <option value="">None</option>
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
                <span className="material-symbols-outlined text-[24px] text-[var(--success)]">check_circle</span>
                <h3 className="text-lg font-bold text-[var(--text-primary)]">Import complete</h3>
              </div>
              <div className="text-[var(--text-muted)]">
                <p>{results.autoMatchedCount} lines were auto-reconciled by rules.</p>
                <p>{results.unmatchedCount} lines were queued for manual reconciliation.</p>
              </div>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-[var(--border)] bg-[var(--bg-secondary)] flex justify-end gap-3 shrink-0">
          {step < 3 && (
            <button onClick={onClose} className="btn btn-secondary">
              Cancel
            </button>
          )}
          
          {step === 1 && (
            <button onClick={handleParse} disabled={!file || !glAccountId || loading} className="btn btn-primary">
              {loading ? 'Parsing...' : 'Next'}
            </button>
          )}

          {step === 2 && (
            <button onClick={handleImport} disabled={loading} className="btn btn-primary">
              {loading ? 'Importing...' : 'Import'}
            </button>
          )}

          {step === 3 && (
            <button onClick={() => { onClose(); onSuccess(); }} className="btn btn-primary">
              Done
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

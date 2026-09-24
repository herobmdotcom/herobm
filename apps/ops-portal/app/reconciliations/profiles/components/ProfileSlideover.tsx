/* eslint-disable i18next/no-literal-string -- Hardcoded string exceptions for standard system IDs, technical constants, or non-translatable symbols. */
'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useTranslations } from 'next-intl';
import * as api from '@herobm/sdk';
import { toast } from 'react-hot-toast';
import { getErrorMessage } from '@herobm/shared';
import SlideOver from '@/components/shared/SlideOver';
import { Button } from '@/components/shared/Button';

export const ALPHABET = Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i));

export const colToLetter = (val: string | undefined | null): string => {
  if (!val) return '';
  if (/^\d+$/.test(val)) {
    let index = parseInt(val, 10);
    let letter = '';
    while (index >= 0) {
      letter = String.fromCharCode((index % 26) + 65) + letter;
      index = Math.floor(index / 26) - 1;
    }
    return letter;
  }
  return val.toUpperCase();
};

export const letterToColIndex = (letter: string | undefined | null): number => {
  if (!letter) return -1;
  const clean = letter.trim().toUpperCase();
  if (/^\d+$/.test(clean)) return parseInt(clean, 10);
  let index = 0;
  for (let i = 0; i < clean.length; i++) {
    index = index * 26 + (clean.charCodeAt(i) - 64);
  }
  return index - 1;
};

export type AmountMappingMode = 'single' | 'dual';

export interface ProfileFormData {
  profileId?: string;
  name: string;
  amountMode: AmountMappingMode;
  dateColumn: string;
  amountColumn: string;
  debitColumn: string;
  creditColumn: string;
  descriptionColumn: string;
  referenceColumn: string;
  typeColumn: string;
  payeeColumn: string;
  headerRows: number;
}

interface ProfileSlideoverProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => Promise<void>;
  profileToEdit?: api.MappingProfileResponseDto | null;
}

const DEFAULT_FORM: ProfileFormData = {
  name: '',
  amountMode: 'single',
  dateColumn: 'A',
  descriptionColumn: 'B',
  amountColumn: 'C',
  debitColumn: '',
  creditColumn: '',
  referenceColumn: '',
  typeColumn: '',
  payeeColumn: '',
  headerRows: 1,
};

export function parseSimpleCsv(text: string): { headers: string[]; rows: string[][] } {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (lines.length === 0) return { headers: [], rows: [] };

  const parseLine = (line: string): string[] => {
    const values: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current.trim());
    return values;
  };

  const headers = parseLine(lines[0]);
  const rows = lines.slice(1).map(parseLine);
  return { headers, rows };
}

export default function ProfileSlideover({
  isOpen,
  onClose,
  onSaved,
  profileToEdit,
}: ProfileSlideoverProps) {
  const tCommon = useTranslations('common');

  const [formData, setFormData] = useState<ProfileFormData>(DEFAULT_FORM);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Sample CSV testing state
  const [sampleFileName, setSampleFileName] = useState<string | null>(null);
  const [sampleHeaders, setSampleHeaders] = useState<string[]>([]);
  const [sampleRows, setSampleRows] = useState<string[][]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      if (profileToEdit) {
        const isDual = Boolean(
          (profileToEdit.debitColumn || profileToEdit.creditColumn) && !profileToEdit.amountColumn,
        );
        setFormData({
          profileId: profileToEdit.profileId,
          name: profileToEdit.name,
          amountMode: isDual ? 'dual' : 'single',
          dateColumn: colToLetter(profileToEdit.dateColumn),
          descriptionColumn: colToLetter(profileToEdit.descriptionColumn),
          amountColumn: colToLetter(profileToEdit.amountColumn),
          debitColumn: colToLetter(profileToEdit.debitColumn),
          creditColumn: colToLetter(profileToEdit.creditColumn),
          referenceColumn: colToLetter(profileToEdit.referenceColumn),
          typeColumn: colToLetter(profileToEdit.typeColumn),
          payeeColumn: colToLetter(profileToEdit.payeeColumn),
          headerRows: Number(profileToEdit.headerRows || 1),
        });
      } else {
        setFormData(DEFAULT_FORM);
      }
      setErrors({});
      setSampleFileName(null);
      setSampleHeaders([]);
      setSampleRows([]);
    }
  }, [isOpen, profileToEdit]);

  const letterOptions = useMemo(() => {
    return ALPHABET.map((letter, idx) => {
      const headerName = sampleHeaders[idx];
      return {
        value: letter,
        label: headerName ? `Column ${letter} (${headerName})` : `Column ${letter}`,
      };
    });
  }, [sampleHeaders]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (text) {
        const { headers, rows } = parseSimpleCsv(text);
        setSampleFileName(file.name);
        setSampleHeaders(headers);
        setSampleRows(rows);
        toast.success(`Loaded sample CSV (${headers.length} columns, ${rows.length} rows)`);

        // Auto-detect columns based on header names if adding a new profile
        if (!profileToEdit) {
          headers.forEach((h, idx) => {
            const col = ALPHABET[idx];
            if (!col) return;
            const norm = h.toLowerCase().trim();
            if (norm.includes('date')) {
              setFormData((prev) => ({ ...prev, dateColumn: col }));
            } else if (norm.includes('desc') || norm.includes('narr') || norm.includes('detail') || norm.includes('memo')) {
              setFormData((prev) => ({ ...prev, descriptionColumn: col }));
            } else if (norm.includes('amount') || norm.includes('net') || norm.includes('total')) {
              setFormData((prev) => ({ ...prev, amountMode: 'single', amountColumn: col }));
            } else if (norm.includes('debit') || norm.includes('out') || norm.includes('spent') || norm.includes('paid out')) {
              setFormData((prev) => ({ ...prev, amountMode: 'dual', debitColumn: col }));
            } else if (norm.includes('credit') || norm.includes('in') || norm.includes('received') || norm.includes('paid in')) {
              setFormData((prev) => ({ ...prev, amountMode: 'dual', creditColumn: col }));
            } else if (norm.includes('ref') || norm.includes('cheque') || norm.includes('check')) {
              setFormData((prev) => ({ ...prev, referenceColumn: col }));
            } else if (norm.includes('payee') || norm.includes('party')) {
              setFormData((prev) => ({ ...prev, payeeColumn: col }));
            }
          });
        }
      }
    };
    reader.readAsText(file);
  };

  const handleClearSample = () => {
    setSampleFileName(null);
    setSampleHeaders([]);
    setSampleRows([]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) newErrors.name = 'Profile name is required';
    if (!formData.dateColumn) newErrors.dateColumn = 'Date column is required';
    if (!formData.descriptionColumn) newErrors.descriptionColumn = 'Description column is required';
    if (formData.headerRows === undefined || formData.headerRows === null || formData.headerRows < 0) {
      newErrors.headerRows = 'Header rows must be 0 or greater';
    }

    if (formData.amountMode === 'single') {
      if (!formData.amountColumn) {
        newErrors.amountColumn = 'Amount column is required';
      }
    } else {
      if (!formData.debitColumn && !formData.creditColumn) {
        newErrors.debitColumn = 'At least Debit or Credit column is required';
        newErrors.creditColumn = 'At least Debit or Credit column is required';
      }
    }

    // Check duplicate column mapping
    const usedCols: Record<string, string> = {};
    const checkCol = (colVal: string, fieldName: string, fieldKey: string) => {
      if (!colVal) return;
      if (usedCols[colVal]) {
        newErrors[fieldKey] = `Cannot use Column ${colVal} for both ${usedCols[colVal]} and ${fieldName}`;
      } else {
        usedCols[colVal] = fieldName;
      }
    };

    checkCol(formData.dateColumn, 'Date', 'dateColumn');
    checkCol(formData.descriptionColumn, 'Description', 'descriptionColumn');
    if (formData.amountMode === 'single') {
      checkCol(formData.amountColumn, 'Amount', 'amountColumn');
    } else {
      checkCol(formData.debitColumn, 'Debit', 'debitColumn');
      checkCol(formData.creditColumn, 'Credit', 'creditColumn');
    }
    checkCol(formData.referenceColumn, 'Reference', 'referenceColumn');
    checkCol(formData.typeColumn, 'Type', 'typeColumn');
    checkCol(formData.payeeColumn, 'Payee', 'payeeColumn');

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) {
      toast.error('Please fix the validation errors before saving.');
      return;
    }

    try {
      setSaving(true);
      const isNew = !formData.profileId || formData.profileId === 'new';

      const payload = {
        name: formData.name.trim(),
        dateColumn: formData.dateColumn,
        amountColumn: formData.amountMode === 'single' ? formData.amountColumn : undefined,
        debitColumn: formData.amountMode === 'dual' ? formData.debitColumn || undefined : undefined,
        creditColumn: formData.amountMode === 'dual' ? formData.creditColumn || undefined : undefined,
        descriptionColumn: formData.descriptionColumn,
        typeColumn: formData.typeColumn || undefined,
        payeeColumn: formData.payeeColumn || undefined,
        referenceColumn: formData.referenceColumn || undefined,
        headerRows: Number(formData.headerRows || 1),
      };

      if (isNew) {
        await api.bankFeedsControllerCreateProfile(payload as api.CreateMappingProfileDto);
        toast.success('Import profile created successfully');
      } else {
        await api.bankFeedsControllerUpdateProfile(
          formData.profileId!,
          payload as api.UpdateMappingProfileDto,
        );
        toast.success('Import profile updated successfully');
      }

      await onSaved();
      onClose();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  // Preview computations
  const previewData = useMemo(() => {
    if (sampleRows.length === 0) return [];

    const effectiveRows = sampleRows.slice(0, 5);
    return effectiveRows.map((row, rIdx) => {
      const dateRaw = row[letterToColIndex(formData.dateColumn)] || '';
      const descRaw = row[letterToColIndex(formData.descriptionColumn)] || '';
      const refRaw = formData.referenceColumn ? row[letterToColIndex(formData.referenceColumn)] || '' : '';
      const payeeRaw = formData.payeeColumn ? row[letterToColIndex(formData.payeeColumn)] || '' : '';

      let parsedAmount: number | null = null;
      let amountFormatted = '';
      let amountDirection: 'deposit' | 'payment' | 'none' = 'none';

      if (formData.amountMode === 'single') {
        const raw = row[letterToColIndex(formData.amountColumn)] || '';
        if (raw) {
          const num = parseFloat(raw.replace(/[^0-9.-]+/g, ''));
          if (!isNaN(num)) {
            parsedAmount = num;
            amountDirection = num >= 0 ? 'deposit' : 'payment';
            amountFormatted = num >= 0 ? `+${num.toFixed(2)}` : `${num.toFixed(2)}`;
          }
        }
      } else {
        const debitRaw = formData.debitColumn ? row[letterToColIndex(formData.debitColumn)] || '' : '';
        const creditRaw = formData.creditColumn ? row[letterToColIndex(formData.creditColumn)] || '' : '';

        if (debitRaw && !isNaN(parseFloat(debitRaw.replace(/[^0-9.-]+/g, '')))) {
          const num = -1 * Math.abs(parseFloat(debitRaw.replace(/[^0-9.-]+/g, '')));
          parsedAmount = num;
          amountDirection = 'payment';
          amountFormatted = `${num.toFixed(2)} (Out)`;
        } else if (creditRaw && !isNaN(parseFloat(creditRaw.replace(/[^0-9.-]+/g, '')))) {
          const num = Math.abs(parseFloat(creditRaw.replace(/[^0-9.-]+/g, '')));
          parsedAmount = num;
          amountDirection = 'deposit';
          amountFormatted = `+${num.toFixed(2)} (In)`;
        }
      }

      const dateParsed = new Date(dateRaw);
      const isDateValid = !isNaN(dateParsed.getTime()) || dateRaw.length > 0;

      return {
        rowIndex: rIdx + 1,
        date: dateRaw || '—',
        isDateValid,
        description: descRaw || '—',
        amountFormatted: amountFormatted || 'No amount',
        parsedAmount,
        amountDirection,
        reference: refRaw || '—',
        payee: payeeRaw || '—',
      };
    });
  }, [sampleRows, formData]);

  return (
    <SlideOver
      isOpen={isOpen}
      onClose={onClose}
      width="max-w-3xl"
      title={profileToEdit ? 'Edit Import Profile' : 'Create Import Profile'}
      subtitle={profileToEdit ? profileToEdit.name : 'Configure and test bank statement CSV column mappings'}
      footer={
        <div className="flex items-center justify-end gap-2 w-full">
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            {tCommon('cancel')}
          </Button>
          <Button variant="primary" onClick={handleSave} disabled={saving}>
            {saving ? tCommon('saving') : tCommon('save')}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-6 text-[var(--text-primary)]">
        {/* SECTION 1: PROFILE INFORMATION */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">
              Profile Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              className={`input w-full ${errors.name ? 'border-red-500' : ''}`}
              value={formData.name}
              onChange={(e) => {
                setFormData((prev) => ({ ...prev, name: e.target.value }));
                if (errors.name) setErrors((prev) => ({ ...prev, name: '' }));
              }}
              placeholder="e.g. Barclays Current Account or Chase CSV"
            />
            {errors.name && <span className="text-xs text-red-500 mt-0.5">{errors.name}</span>}
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">
              Header Rows to Skip
            </label>
            <input
              type="number"
              min="0"
              className={`input w-full ${errors.headerRows ? 'border-red-500' : ''}`}
              value={formData.headerRows}
              onChange={(e) => {
                setFormData((prev) => ({ ...prev, headerRows: parseInt(e.target.value, 10) || 0 }));
                if (errors.headerRows) setErrors((prev) => ({ ...prev, headerRows: '' }));
              }}
            />
            {errors.headerRows && <span className="text-xs text-red-500 mt-0.5">{errors.headerRows}</span>}
          </div>
        </div>

        <hr className="border-[var(--border)]" />

        {/* SECTION 2: AMOUNT FORMAT SELECTION */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* OPTION 1: SINGLE AMOUNT COLUMN */}
            <div
              onClick={() => {
                setFormData((prev) => ({
                  ...prev,
                  amountMode: 'single',
                  debitColumn: '',
                  creditColumn: '',
                }));
                if (errors.amountColumn || errors.debitColumn || errors.creditColumn) {
                  setErrors((prev) => ({ ...prev, amountColumn: '', debitColumn: '', creditColumn: '' }));
                }
              }}
              className={`p-4 rounded-xl border transition-all cursor-pointer flex flex-col justify-between gap-3 ${
                formData.amountMode === 'single'
                  ? 'border-[var(--accent)] bg-[var(--accent-glow)] ring-2 ring-[var(--accent)]/30'
                  : 'border-[var(--border)] bg-[var(--bg-secondary)]/40 hover:bg-[var(--bg-secondary)]'
              }`}
            >
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-[var(--text-primary)]">
                    Single Amount Column (+ / -)
                  </span>
                  <input
                    type="radio"
                    name="amountMode"
                    checked={formData.amountMode === 'single'}
                    onChange={() => {}}
                    className="accent-[var(--accent)]"
                  />
                </div>
                <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                  Your CSV has one column containing positive numbers for deposits and negative numbers for payments.
                </p>
              </div>

              <div className="flex items-center gap-2 pt-2 border-t border-[var(--border)]/60 text-[11px] font-mono">
                <span className="px-2 py-0.5 rounded bg-[var(--bg-card)] text-[var(--success)] font-semibold border border-[var(--border)]">
                  +£1,250.00
                </span>
                <span className="px-2 py-0.5 rounded bg-[var(--bg-card)] text-[var(--danger)] font-semibold border border-[var(--border)]">
                  -£45.50
                </span>
              </div>
            </div>

            {/* OPTION 2: SEPARATE DEBIT & CREDIT COLUMNS */}
            <div
              onClick={() => {
                setFormData((prev) => ({
                  ...prev,
                  amountMode: 'dual',
                  amountColumn: '',
                }));
                if (errors.amountColumn || errors.debitColumn || errors.creditColumn) {
                  setErrors((prev) => ({ ...prev, amountColumn: '', debitColumn: '', creditColumn: '' }));
                }
              }}
              className={`p-4 rounded-xl border transition-all cursor-pointer flex flex-col justify-between gap-3 ${
                formData.amountMode === 'dual'
                  ? 'border-[var(--accent)] bg-[var(--accent-glow)] ring-2 ring-[var(--accent)]/30'
                  : 'border-[var(--border)] bg-[var(--bg-secondary)]/40 hover:bg-[var(--bg-secondary)]'
              }`}
            >
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-[var(--text-primary)]">
                    Separate Debit & Credit
                  </span>
                  <input
                    type="radio"
                    name="amountMode"
                    checked={formData.amountMode === 'dual'}
                    onChange={() => {}}
                    className="accent-[var(--accent)]"
                  />
                </div>
                <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                  Your CSV has two separate columns: one for Money Out (Debit) and one for Money In (Credit).
                </p>
              </div>

              <div className="flex items-center gap-2 pt-2 border-t border-[var(--border)]/60 text-[11px] font-mono">
                <span className="px-2 py-0.5 rounded bg-[var(--bg-card)] text-[var(--danger)] font-semibold border border-[var(--border)]">
                  Debit: £45.50
                </span>
                <span className="px-2 py-0.5 rounded bg-[var(--bg-card)] text-[var(--success)] font-semibold border border-[var(--border)]">
                  Credit: £1,250.00
                </span>
              </div>
            </div>
          </div>

        <hr className="border-[var(--border)]" />

        {/* SECTION 3: COLUMN MAPPINGS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Required Core Columns */}
          <div>
            <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">
              Date Column <span className="text-red-500">*</span>
            </label>
            <select
              className={`input w-full ${errors.dateColumn ? 'border-red-500' : ''}`}
              value={formData.dateColumn}
              onChange={(e) => {
                setFormData((prev) => ({ ...prev, dateColumn: e.target.value }));
                if (errors.dateColumn) setErrors((prev) => ({ ...prev, dateColumn: '' }));
              }}
            >
              <option value="">Select Column...</option>
              {letterOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            {errors.dateColumn && <span className="text-xs text-red-500">{errors.dateColumn}</span>}
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">
              Description Column <span className="text-red-500">*</span>
            </label>
            <select
              className={`input w-full ${errors.descriptionColumn ? 'border-red-500' : ''}`}
              value={formData.descriptionColumn}
              onChange={(e) => {
                setFormData((prev) => ({ ...prev, descriptionColumn: e.target.value }));
                if (errors.descriptionColumn) setErrors((prev) => ({ ...prev, descriptionColumn: '' }));
              }}
            >
              <option value="">Select Column...</option>
              {letterOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            {errors.descriptionColumn && <span className="text-xs text-red-500">{errors.descriptionColumn}</span>}
          </div>

          {/* Dynamic Amount Inputs */}
          {formData.amountMode === 'single' ? (
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">
                Amount Column (+ / -) <span className="text-red-500">*</span>
              </label>
              <select
                className={`input w-full ${errors.amountColumn ? 'border-red-500' : ''}`}
                value={formData.amountColumn}
                onChange={(e) => {
                  setFormData((prev) => ({ ...prev, amountColumn: e.target.value }));
                  if (errors.amountColumn) setErrors((prev) => ({ ...prev, amountColumn: '' }));
                }}
              >
                <option value="">Select Column...</option>
                {letterOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              {errors.amountColumn && <span className="text-xs text-red-500">{errors.amountColumn}</span>}
            </div>
          ) : (
            <>
              <div>
                <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">
                  Debit Column (Money Out)
                </label>
                <select
                  className={`input w-full ${errors.debitColumn ? 'border-red-500' : ''}`}
                  value={formData.debitColumn}
                  onChange={(e) => {
                    setFormData((prev) => ({ ...prev, debitColumn: e.target.value }));
                    if (errors.debitColumn) setErrors((prev) => ({ ...prev, debitColumn: '' }));
                  }}
                >
                  <option value="">None</option>
                  {letterOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                {errors.debitColumn && <span className="text-xs text-red-500">{errors.debitColumn}</span>}
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">
                  Credit Column (Money In)
                </label>
                <select
                  className={`input w-full ${errors.creditColumn ? 'border-red-500' : ''}`}
                  value={formData.creditColumn}
                  onChange={(e) => {
                    setFormData((prev) => ({ ...prev, creditColumn: e.target.value }));
                    if (errors.creditColumn) setErrors((prev) => ({ ...prev, creditColumn: '' }));
                  }}
                >
                  <option value="">None</option>
                  {letterOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                {errors.creditColumn && <span className="text-xs text-red-500">{errors.creditColumn}</span>}
              </div>
            </>
          )}

          {/* Optional Columns */}
          <div>
            <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">
              Reference Column
            </label>
            <select
              className={`input w-full ${errors.referenceColumn ? 'border-red-500' : ''}`}
              value={formData.referenceColumn}
              onChange={(e) => {
                setFormData((prev) => ({ ...prev, referenceColumn: e.target.value }));
                if (errors.referenceColumn) setErrors((prev) => ({ ...prev, referenceColumn: '' }));
              }}
            >
              <option value="">None</option>
              {letterOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            {errors.referenceColumn && <span className="text-xs text-red-500">{errors.referenceColumn}</span>}
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">
              Payee Column
            </label>
            <select
              className={`input w-full ${errors.payeeColumn ? 'border-red-500' : ''}`}
              value={formData.payeeColumn}
              onChange={(e) => {
                setFormData((prev) => ({ ...prev, payeeColumn: e.target.value }));
                if (errors.payeeColumn) setErrors((prev) => ({ ...prev, payeeColumn: '' }));
              }}
            >
              <option value="">None</option>
              {letterOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            {errors.payeeColumn && <span className="text-xs text-red-500">{errors.payeeColumn}</span>}
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">
              Transaction Type Column
            </label>
            <select
              className={`input w-full ${errors.typeColumn ? 'border-red-500' : ''}`}
              value={formData.typeColumn}
              onChange={(e) => {
                setFormData((prev) => ({ ...prev, typeColumn: e.target.value }));
                if (errors.typeColumn) setErrors((prev) => ({ ...prev, typeColumn: '' }));
              }}
            >
              <option value="">None</option>
              {letterOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            {errors.typeColumn && <span className="text-xs text-red-500">{errors.typeColumn}</span>}
          </div>
        </div>

        <hr className="border-[var(--border)]" />

        {/* SECTION 4: TEST MAPPING */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <input
              type="file"
              ref={fileInputRef}
              accept=".csv"
              onChange={handleFileUpload}
              className="hidden"
            />
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
            >
              <span>Upload Sample CSV</span>
            </Button>
            {sampleFileName && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleClearSample}
                className="text-xs text-red-500 hover:text-red-700 !p-1"
                title="Clear sample"
              >
                <span className="material-symbols-outlined text-[16px]">close</span>
              </Button>
            )}
          </div>

          {sampleFileName && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-[var(--bg-secondary)] rounded-md border border-[var(--border)] text-xs text-[var(--text-secondary)]">
              <span className="material-symbols-outlined text-[16px] text-[var(--accent)]">description</span>
              <span className="font-semibold text-[var(--text-primary)]">{sampleFileName}</span>
              <span className="text-[var(--text-muted)]">• {sampleHeaders.length} columns detected</span>
            </div>
          )}

          {/* Live Preview Table */}
          {previewData.length > 0 ? (
            <div className="rounded-xl border border-[var(--border)] overflow-hidden bg-[var(--bg-card)]">
              <div className="px-4 py-2.5 bg-[var(--bg-secondary)] border-b border-[var(--border)] flex items-center justify-between">
                <span className="text-xs font-bold text-[var(--text-primary)]">
                  Live Parsed Output Preview (First {previewData.length} rows)
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-[var(--bg-secondary)]/50 border-b border-[var(--border)] text-[var(--text-muted)] font-semibold">
                    <tr>
                      <th className="py-2 px-3">#</th>
                      <th className="py-2 px-3">Date</th>
                      <th className="py-2 px-3">Description</th>
                      <th className="py-2 px-3">Parsed Amount</th>
                      <th className="py-2 px-3">Reference</th>
                      <th className="py-2 px-3">Payee</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]">
                    {previewData.map((row) => (
                      <tr key={row.rowIndex} className="hover:bg-[var(--bg-secondary)]/30">
                        <td className="py-2 px-3 text-[var(--text-muted)] font-mono">{row.rowIndex}</td>
                        <td className="py-2 px-3 font-mono font-medium">{row.date}</td>
                        <td className="py-2 px-3 max-w-[200px] truncate" title={row.description}>
                          {row.description}
                        </td>
                        <td className="py-2 px-3">
                          {row.amountDirection === 'deposit' ? (
                            <span className="px-2 py-0.5 rounded font-mono font-bold text-[var(--success)] bg-[var(--success)]/10 border border-[var(--success)]/20">
                              {row.amountFormatted}
                            </span>
                          ) : row.amountDirection === 'payment' ? (
                            <span className="px-2 py-0.5 rounded font-mono font-bold text-[var(--danger)] bg-[var(--danger)]/10 border border-[var(--danger)]/20">
                              {row.amountFormatted}
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded font-mono text-[var(--text-muted)] bg-[var(--bg-secondary)]">
                              {row.amountFormatted}
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-[var(--text-muted)]">{row.reference}</td>
                        <td className="py-2 px-3 text-[var(--text-muted)]">{row.payee}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="p-6 border border-dashed border-[var(--border)] rounded-xl bg-[var(--bg-secondary)]/20 text-center flex flex-col items-center justify-center gap-1">
              <p className="text-xs text-[var(--text-muted)]">
                Upload a sample CSV above to preview how this profile parses transaction rows.
              </p>
            </div>
          )}
        </div>
      </div>
    </SlideOver>
  );
}

'use client';

import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { useTranslations } from 'next-intl';
import * as api from '@herobm/sdk';
import { getErrorMessage } from '@herobm/shared';

interface Expiry {
  expiryId: string;
  vendorId: string;
  expiryType: string;
  expiryDate: string;
  notes: string | null;
}

interface Props {
  vendorId: string;
  isEditable: boolean;
}

import { InlineSettingsTable, InlineTableColumn } from '@/components/shared/InlineSettingsTable';

// ... (keep the imports above)

export default function SupplierExpiries({ vendorId, isEditable }: Props) {
  const tSupplier = useTranslations('suppliers');
  const tCommon = useTranslations('common');
  const [expiries, setExpiries] = useState<Expiry[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    try {
      setLoading(true);
      const data = await api.suppliersControllerFindSupplierExpiries(vendorId);
      const dataObj = data as unknown as Record<string, unknown>;
      let payload = (dataObj?.data || data || []) as unknown;
      if (payload && !Array.isArray(payload) && typeof payload === 'object' && 'data' in payload && Array.isArray((payload as Record<string, unknown>).data)) {
        payload = (payload as Record<string, unknown>).data;
      }
      setExpiries(payload as Expiry[]);
    } catch (err: unknown) {
      toast.error(tCommon('errors.failedToLoadExpiries') + ': ' + getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (vendorId) loadData();
  }, [vendorId]);

  const getTypeLabel = (val: string) => {
    switch (val) {
      case 'insurance': return tSupplier('expiries.types.insurance');
      case 'tax_certificate': return tSupplier('expiries.types.tax_certificate');
      case 'trial_period': return tSupplier('expiries.types.trial_period');
      case 'other': return tSupplier('expiries.types.other');
      default: return val;
    }
  };

  const columns: InlineTableColumn<Expiry>[] = [
    {
      key: 'expiryType',
      title: tSupplier('expiries.columns.type'),
      width: 180,
      render: (row, isEditing, onChange) => {
        if (isEditing) {
          return (
            <select className="input" value={row.expiryType || ''} onChange={e => onChange?.(e.target.value)}>
              <option value="">{tSupplier('expiries.types.select')}</option>
              <option value="insurance">{tSupplier('expiries.types.insurance')}</option>
              <option value="tax_certificate">{tSupplier('expiries.types.tax_certificate')}</option>
              <option value="trial_period">{tSupplier('expiries.types.trial_period')}</option>
              <option value="other">{tSupplier('expiries.types.other')}</option>
            </select>
          );
        }
        const isExpired = row.expiryDate && new Date(row.expiryDate) < new Date();
        return (
          <div className="font-medium flex items-center">
            {getTypeLabel(row.expiryType)}
            {isExpired && (
              <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-700 uppercase tracking-wider">
                {tSupplier('expiries.expired')}
              </span>
            )}
          </div>
        );
      }
    },
    {
      key: 'expiryDate',
      title: tSupplier('expiries.columns.expiryDate'),
      width: 150,
      render: (row, isEditing, onChange) => {
        if (isEditing) {
          const val = row.expiryDate ? new Date(row.expiryDate).toISOString().split('T')[0] : '';
          return (
            <input type="date" className="input w-full" value={val} onChange={e => onChange?.(e.target.value)} />
          );
        }
        if (!row.expiryDate) return null;
        const isExpired = new Date(row.expiryDate) < new Date();
        return (
          <div className={`text-sm ${isExpired ? 'text-red-700 font-bold' : ''}`}>
            {new Date(row.expiryDate).toLocaleDateString()}
          </div>
        );
      }
    },
    {
      key: 'notes',
      title: tSupplier('expiries.columns.notes'),
      render: (row, isEditing, onChange) => {
        if (isEditing) {
          return (
            <input type="text" className="input w-full" value={row.notes || ''} onChange={e => onChange?.(e.target.value)} placeholder={`${tSupplier('expiries.columns.notes')}...`} />
          );
        }
        return row.notes ? <span>{row.notes}</span> : <span className="text-muted italic text-xs">{tSupplier('expiries.noNotes')}</span>;
      }
    }
  ];

  const handleSave = async (row: Expiry, isNew: boolean) => {
    if (!row.expiryType || !row.expiryDate) {
      toast.error(tCommon('errors.typeAndDateRequired'));
      throw new Error('Validation failed');
    }

    const dateObj = new Date(row.expiryDate);
    const payload = {
      expiryType: row.expiryType as api.CreateSupplierExpiryDto['expiryType'],
      expiryDate: dateObj.toISOString(),
      notes: row.notes || undefined,
    };

    if (isNew) {
      await api.suppliersControllerCreateExpiry(vendorId, payload);
      toast.success(tCommon('toast.expiryCreated'));
    } else {
      await api.suppliersControllerUpdateExpiry(vendorId, row.expiryId, payload);
      toast.success(tCommon('toast.expiryUpdated'));
    }
    loadData();
  };

  const handleDelete = async (row: Expiry) => {
    if(!confirm(tCommon('confirmDelete'))) throw new Error('Cancelled');
    await api.suppliersControllerDeleteExpiry(vendorId, row.expiryId);
    toast.success(tCommon('toast.expiryDeleted'));
    loadData();
  };

  const handleAdd = () => {
    return {
      expiryId: '',
      vendorId,
      expiryType: '',
      expiryDate: '',
      notes: null
    } as Expiry;
  };

  if (loading && expiries.length === 0) {
    return <div className="card mb-6 p-4 text-center text-muted">{tCommon('loading')}</div>;
  }

  return (
    <div className="card mb-6">
      <InlineSettingsTable<Expiry>
        title={
          <h3 className="text-sm font-semibold mb-0" style={{ color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {tSupplier('expiries.title')}
          </h3>
        }
        columns={columns}
        data={expiries}
        rowKey={(row) => row.expiryId}
        onSave={handleSave}
        onDelete={isEditable ? handleDelete : undefined}
        onAdd={isEditable ? handleAdd : undefined}
        addLabel={tSupplier('expiries.addExpiry')}
        emptyLabel={tSupplier('expiries.empty')}
        canEdit={() => isEditable}
        canDelete={() => isEditable}
      />
    </div>
  );
}

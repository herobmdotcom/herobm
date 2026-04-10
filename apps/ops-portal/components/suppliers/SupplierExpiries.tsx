'use client';

import { useState, useEffect } from 'react';
import { apiFetch, apiMutate } from '@/lib/api';
import { toast } from 'react-hot-toast';
import { useTranslations } from 'next-intl';

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

export default function SupplierExpiries({ vendorId, isEditable }: Props) {
  const tSupplier = useTranslations('suppliers');
  const tCommon = useTranslations('common');
  const [expiries, setExpiries] = useState<Expiry[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<Expiry>>({});
  const [isCreating, setIsCreating] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const data = await apiFetch<any>(`/api/suppliers/${vendorId}/expiries`);
      // handle either array or paginated response format
      setExpiries(data.data || data || []);
    } catch(err: any) {
      toast.error(tCommon('errors.failedToLoadExpiries') + ': ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (vendorId) loadData();
  }, [vendorId]);

  const handleEdit = (expiry: Expiry) => {
    setEditingId(expiry.expiryId);
    setEditForm({ 
      ...expiry, 
      expiryDate: expiry.expiryDate ? new Date(expiry.expiryDate).toISOString().split('T')[0] : '' 
    });
    setIsCreating(false);
  };

  const handleCreate = () => {
    setIsCreating(true);
    setEditingId(null);
    setEditForm({
      expiryType: '',
      expiryDate: '',
      notes: ''
    });
  };

  const handleCancel = () => {
    setEditingId(null);
    setIsCreating(false);
  };

  const handleSave = async () => {
    if (!editForm.expiryType || !editForm.expiryDate) {
      toast.error(tCommon('errors.typeAndDateRequired'));
      return;
    }
    
    // Convert local date string to start of day UTC
    const dateObj = new Date(editForm.expiryDate);
    
    const payload = {
      expiryType: editForm.expiryType,
      expiryDate: dateObj.toISOString(),
      notes: editForm.notes || null,
    };

    try {
      if (editingId) {
        await apiMutate(`/api/suppliers/${vendorId}/expiries/${editingId}`, 'PATCH', payload);
        toast.success(tCommon('toast.expiryUpdated'));
      } else {
        await apiMutate(`/api/suppliers/${vendorId}/expiries`, 'POST', payload);
        toast.success(tCommon('toast.expiryCreated'));
      }
      handleCancel();
      loadData();
    } catch(err: any) {
      toast.error(err.message);
    }
  };

  const handleDelete = async (id: string) => {
    if(!confirm(tCommon('confirmDelete'))) return;
    try {
      await apiMutate(`/api/suppliers/${vendorId}/expiries/${id}`, 'DELETE');
      toast.success(tCommon('toast.expiryDeleted'));
      loadData();
    } catch(err: any) {
      toast.error(err.message);
    }
  };

  const getTypeLabel = (val: string) => {
    switch (val) {
      case 'insurance': return tSupplier('expiries.types.insurance');
      case 'tax_certificate': return tSupplier('expiries.types.tax_certificate');
      case 'trial_period': return tSupplier('expiries.types.trial_period');
      case 'other': return tSupplier('expiries.types.other');
      default: return val;
    }
  };

  return (
    <div className="card mb-6">
      <div className="flex items-center justify-between mb-4">
        <h3
          className="text-sm font-semibold mb-0"
          style={{ color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}
        >
          {tSupplier('expiries.title')}
        </h3>
        {isEditable && !isCreating && !editingId && (
          <button className="btn btn-primary btn-xs" onClick={handleCreate}>
            {tSupplier('expiries.addExpiry')}
          </button>
        )}
      </div>

      <table className="table-lines w-full">
        <thead>
          <tr>
            <th style={{ width: 180 }}>{tSupplier('expiries.columns.type')}</th>
            <th style={{ width: 150 }}>{tSupplier('expiries.columns.expiryDate')}</th>
            <th>{tSupplier('expiries.columns.notes')}</th>
            <th style={{ width: 150, textAlign: 'right' }}>{tSupplier('expiries.columns.actions')}</th>
          </tr>
        </thead>
        <tbody>
          {isCreating && (
            <tr style={{ background: 'var(--bg-secondary)' }}>
              <td>
                <select className="input" value={editForm.expiryType || ''} onChange={e => setEditForm({...editForm, expiryType: e.target.value})}>
                  <option value="">{tSupplier('expiries.types.select')}</option>
                  <option value="insurance">{tSupplier('expiries.types.insurance')}</option>
                  <option value="tax_certificate">{tSupplier('expiries.types.tax_certificate')}</option>
                  <option value="trial_period">{tSupplier('expiries.types.trial_period')}</option>
                  <option value="other">{tSupplier('expiries.types.other')}</option>
                </select>
              </td>
              <td>
                <input type="date" className="input" value={editForm.expiryDate || ''} onChange={e => setEditForm({...editForm, expiryDate: e.target.value})} />
              </td>
              <td>
                <input className="input w-full" value={editForm.notes || ''} onChange={e => setEditForm({...editForm, notes: e.target.value})} placeholder={`${tSupplier('expiries.columns.notes')}...`} />
              </td>
              <td style={{ textAlign: 'right' }}>
                <div className="flex justify-end gap-2">
                  <button className="btn btn-secondary btn-xs" onClick={handleCancel}>{tCommon('cancel')}</button>
                  <button className="btn btn-primary btn-xs" onClick={handleSave}>{tCommon('save')}</button>
                </div>
              </td>
            </tr>
          )}
          
          {!loading && expiries.length === 0 && !isCreating && (
            <tr>
              <td colSpan={4} style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text-muted)' }}>
                {tSupplier('expiries.empty')}
              </td>
            </tr>
          )}

          {expiries.map(e => (
            editingId === e.expiryId ? (
              <tr key={e.expiryId} style={{ background: 'var(--bg-secondary)' }}>
                <td>
                  <select className="input" value={editForm.expiryType || ''} onChange={ev => setEditForm({...editForm, expiryType: ev.target.value})}>
                    <option value="">{tSupplier('expiries.types.select')}</option>
                    <option value="insurance">{tSupplier('expiries.types.insurance')}</option>
                    <option value="tax_certificate">{tSupplier('expiries.types.tax_certificate')}</option>
                    <option value="trial_period">{tSupplier('expiries.types.trial_period')}</option>
                    <option value="other">{tSupplier('expiries.types.other')}</option>
                  </select>
                </td>
                <td>
                  <input type="date" className="input" value={editForm.expiryDate || ''} onChange={ev => setEditForm({...editForm, expiryDate: ev.target.value})} />
                </td>
                <td>
                  <input className="input w-full" value={editForm.notes || ''} onChange={ev => setEditForm({...editForm, notes: ev.target.value})} />
                </td>
                <td style={{ textAlign: 'right' }}>
                  <div className="flex justify-end gap-2">
                    <button className="btn btn-secondary btn-xs" onClick={handleCancel}>{tCommon('cancel')}</button>
                    <button className="btn btn-primary btn-xs" onClick={handleSave}>{tCommon('save')}</button>
                  </div>
                </td>
              </tr>
            ) : (
              <tr key={e.expiryId} style={{ background: new Date(e.expiryDate) < new Date() ? 'rgba(239, 68, 68, 0.05)' : undefined }}>
                <td className="font-medium">
                  {getTypeLabel(e.expiryType)}
                  {new Date(e.expiryDate) < new Date() && (
                    <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-700 uppercase tracking-wider">{tSupplier('expiries.expired')}</span>
                  )}
                </td>
                <td className={`text-sm ${new Date(e.expiryDate) < new Date() ? 'text-red-700 font-bold' : ''}`}>
                  {new Date(e.expiryDate).toLocaleDateString()}
                </td>
                <td>{e.notes || <span className="text-muted italic text-xs">{tSupplier('expiries.noNotes')}</span>}</td>
                <td style={{ textAlign: 'right' }}>
                  {isEditable && (
                    <div className="flex justify-end gap-2">
                      <button className="btn btn-secondary btn-xs" onClick={() => handleEdit(e)}>{tCommon('edit')}</button>
                      <button className="btn btn-secondary btn-xs" style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }} onClick={() => handleDelete(e.expiryId)}>{tCommon('delete')}</button>
                    </div>
                  )}
                </td>
              </tr>
            )
          ))}
        </tbody>
      </table>
    </div>
  );
}

'use client';

import React, { useState, useEffect, useRef } from 'react';
import * as api from '@modbm/sdk';
import { toast } from 'react-hot-toast';
import { useTranslations } from 'next-intl';
import { getErrorMessage } from '@modbm/shared';

interface AddSupplierModalProps {
  productId: string;
  productName: string;
  productNumber: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function AddSupplierModal({ 
  productId, productName, productNumber, isOpen, onClose, onSuccess 
}: AddSupplierModalProps) {
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [lastSearchQuery, setLastSearchQuery] = useState('');
  const t = useTranslations('products.supplierModal');
  
  // Selection State
  const [vendorId, setVendorId] = useState('');
  const [selectedVendorName, setSelectedVendorName] = useState('');

  // Form State
  const [supplierPartNumber, setSupplierPartNumber] = useState('');
  const [costPrice, setCostPrice] = useState('0.00');

  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      setVendorId('');
      setSelectedVendorName('');
      setSearch('');
      setLastSearchQuery('');
      setSuppliers([]);
      setSupplierPartNumber('');
      setCostPrice('0.00');
      setError(null);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    if (search.length < 2 || search === selectedVendorName) {
      setSuppliers([]);
      return;
    }

    const timer = setTimeout(() => {
      fetchSuppliers(search);
    }, 400);

    return () => clearTimeout(timer);
  }, [search, isOpen, selectedVendorName]);

  const fetchSuppliers = async (q: string) => {
    setLoading(true);
    try {
      const res = await api.suppliersControllerFindAll({ q, limit: 15 } as any);
      setSuppliers((res.data as any)?.data || res.data || []);
      setLastSearchQuery(q);
    } catch (err: unknown) {
      // quiet fail
    } finally {
      setLoading(false);
    }
  };

  const handleSearchChange = (val: string) => {
    setSearch(val);
    if (vendorId && val !== selectedVendorName) {
      setVendorId('');
      setSelectedVendorName('');
    }
  };

  const selectSupplier = (s: any) => {
    setVendorId(s.vendorId);
    setSearch(s.name);
    setSelectedVendorName(s.name);
    setSuppliers([]); // close the dropdown
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vendorId) {
      setError(t('messages.selectDropdown'));
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await api.productsControllerAddSupplier(productId, {
        vendorId,
        supplierPartNumber: supplierPartNumber || undefined,
        costPrice: parseFloat(costPrice) || 0,
      });
      toast.success(t('messages.success'));
      onSuccess();
      onClose();
    } catch (err: unknown) {
      setError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setSuppliers([]);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [wrapperRef]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 pt-10">
      <div className="bg-white rounded-xl shadow-2xl max-w-[540px] w-full flex flex-col overflow-visible max-h-[90vh]">
        
        {/* Header */}
        <div className="px-6 py-5 border-b border-gray-200 flex items-center justify-between bg-white shrink-0 rounded-t-xl">
          <h3 className="font-bold text-xl text-[#041627]" style={{ fontFamily: 'Manrope, sans-serif' }}>
            {t('title')}
          </h3>
          <button 
            type="button" 
            className="btn btn-sm btn-circle btn-ghost text-gray-500 hover:text-gray-800 hover:bg-gray-100" 
            onClick={onClose}
          >
            {/* eslint-disable-next-line i18next/no-literal-string */}
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Product Context Banner */}
        <div className="bg-gray-50 border-b border-gray-100 px-6 py-3 flex items-center gap-3">
          <div className="w-10 h-10 rounded bg-white border border-gray-200 flex items-center justify-center shrink-0 shadow-sm">
            {/* eslint-disable-next-line i18next/no-literal-string */}
            <span className="material-symbols-outlined text-gray-400 text-[20px]">inventory_2</span>
          </div>
          <div className="min-w-0">
             <div className="text-xs font-bold text-gray-500 uppercase tracking-widest">{productNumber}</div>
             <div className="text-[15px] font-semibold text-gray-900 truncate">{productName}</div>
          </div>
        </div>
        
        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6 overflow-y-auto bg-white flex-1 rounded-b-xl">
          
          <div className="relative" ref={wrapperRef}>
            <label className="block text-[13px] font-bold tracking-wide uppercase text-gray-500 mb-2">{t('inputs.searchSupplier')}</label>
            <div className="relative">
               {/* eslint-disable-next-line i18next/no-literal-string */}
               <span autoFocus className="material-symbols-outlined absolute left-3.5 top-[11px] text-gray-400 text-[20px] pointer-events-none z-10">search</span>
               <input 
                 type="text" 
                 style={{ paddingLeft: '42px' }}
                 className={`input input-bordered w-full h-11 text-[15px] transition-colors focus:bg-white ${vendorId ? 'bg-[#e2f9f5] border-[#006b5c]/40 font-semibold text-[#006b5c]' : 'bg-white text-gray-900 border-gray-300'}`}
                 placeholder={t('inputs.searchPlaceholder')}
                 value={search}
                 onChange={(e) => handleSearchChange(e.target.value)}
                 autoComplete="off"
               />
               {loading && (
                 <div className="absolute right-3 top-[13px]">
                   <span className="loading loading-spinner loading-xs text-gray-400"></span>
                 </div>
               )}
            </div>

            {/* Floating Dropdown Results */}
            {suppliers.length > 0 && (
              <div className="absolute z-50 left-0 right-0 mt-2 bg-white border border-gray-200 rounded-lg shadow-xl overflow-hidden max-h-60 overflow-y-auto w-[calc(100%+20px)] -ml-[10px] p-1">
                <ul className="py-1">
                  {(Array.isArray(suppliers) ? suppliers : []).map(s => (
                    <li key={s.vendorId}>
                      <button
                        type="button"
                        className="w-full text-left px-4 py-2.5 hover:bg-[#e2f9f5] flex flex-col focus:bg-[#e2f9f5] focus:outline-none transition-colors rounded-md"
                        onClick={() => selectSupplier(s)}
                      >
                        <span className="font-semibold text-gray-900">{s.name}</span>
                        {s.vendorNumber && <span className="text-xs text-gray-500 font-medium">{s.vendorNumber}</span>}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            
            {!loading && search.length >= 2 && suppliers.length === 0 && !vendorId && lastSearchQuery === search && (
              // eslint-disable-next-line i18next/no-literal-string
              <div className="mt-2 text-sm text-gray-500 flex items-center gap-1.5 px-1"><span className="material-symbols-outlined text-[16px]">info</span> {t('inputs.noSuppliersFound', { search })}</div>
            )}
            
            {vendorId && (
              // eslint-disable-next-line i18next/no-literal-string
              <div className="mt-2 text-sm text-[#006b5c] font-semibold flex items-center gap-1.5 px-1"><span className="material-symbols-outlined text-[18px]">check_circle</span> {t('inputs.supplierSelected')}</div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-5 pt-2">
            <div>
              <label className="block text-[13px] font-bold tracking-wide uppercase text-gray-500 mb-2">{t('inputs.supplierPartNo')}</label>
              <input
                className="input input-bordered w-full h-11 text-[15px] bg-white text-gray-900 border-gray-300 focus:border-[#006b5c]"
                placeholder="Ex. 104-XX"
                value={supplierPartNumber}
                onChange={(e) => setSupplierPartNumber(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-[13px] font-bold tracking-wide uppercase text-gray-500 mb-2">{t('inputs.costPrice')}</label>
              <input
                type="number"
                step="0.01"
                min="0"
                className="input input-bordered w-full h-11 text-[15px] font-medium bg-white text-gray-900 border-gray-300 focus:border-[#006b5c]"
                value={costPrice}
                onChange={(e) => setCostPrice(e.target.value)}
              />
            </div>
          </div>

          {error && (
            <div className="mt-4 p-3 bg-red-50 text-red-700 border border-red-200 rounded-md text-[14px] flex items-start gap-2 shadow-sm font-medium">
              {/* eslint-disable-next-line i18next/no-literal-string */}
              <span className="material-symbols-outlined text-[18px] text-red-500 mt-[1px]">error</span>
              <span className="flex-1 leading-snug">{error}</span>
            </div>
          )}

          <div className="mt-8 pt-6 flex justify-end gap-3 border-t border-gray-100">
             <button type="button" className="btn btn-ghost hover:bg-gray-100 text-gray-700 h-11 min-h-[44px] px-6 font-semibold" onClick={onClose} disabled={submitting}>
               {t('buttons.cancel')}
             </button>
             <button type="submit" className="btn bg-[#006b5c] hover:bg-[#005246] border-none text-white h-11 min-h-[44px] px-8 font-semibold shadow-sm text-[15px]" disabled={submitting || !vendorId}>
               {submitting ? <span className="loading loading-spinner loading-sm text-white"></span> : t('buttons.linkProduct')}
             </button>
          </div>
        </form>
      </div>
    </div>
  );
}

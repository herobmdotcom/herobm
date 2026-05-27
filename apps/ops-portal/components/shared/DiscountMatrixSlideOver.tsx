'use client';

import { useState, useEffect, useCallback } from 'react';
import * as api from '@modbm/sdk';
import { toast } from 'react-hot-toast';
import { useTranslations } from 'next-intl';
import SlideOver from './SlideOver';

interface ProductGroup {
  productGroupId: string;
  groupCode: string;
  name: string;
}

interface DiscountRule {
  discountMatrixId: string;
  customerGroupId: string | null;
  customerId: string | null;
  productGroupId: string | null;
  discountPercentage: string;
}

interface DiscountMatrixSlideOverProps {
  open: boolean;
  onClose: () => void;
  ownerLabel: string;
  customerGroupId?: string;
  customerId?: string;
}

export default function DiscountMatrixSlideOver({
  open,
  onClose,
  ownerLabel,
  customerGroupId,
  customerId,
}: DiscountMatrixSlideOverProps) {
  const t = useTranslations('admin.discountMatrix');
  const tCommon = useTranslations('common');

  const [rules, setRules] = useState<DiscountRule[]>([]);
  const [productGroups, setProductGroups] = useState<ProductGroup[]>([]);
  const [loading, setLoading] = useState(false);

  // New rule form
  const [newProductGroupId, setNewProductGroupId] = useState('');
  const [newDiscount, setNewDiscount] = useState('');

  const ownerId = customerGroupId || customerId || '';
  const ownerParam = customerGroupId
    ? `customerGroupId=${customerGroupId}`
    : `customerId=${customerId}`;

  const loadData = useCallback(async () => {
    if (!ownerId) return;
    setLoading(true);
    try {
      const [rulesRes, pgRes] = await Promise.all([
        api.discountMatrixControllerList({
          customerGroupId: customerGroupId || undefined,
          customerId: customerId || undefined,
        } as any),
        api.productGroupsControllerFindAll(),
      ]);
      // @ts-expect-error
      setRules(rulesRes.data || []);
      // @ts-expect-error
      setProductGroups(pgRes.data || []);
    } catch (err: any) {
      toast.error('Failed to load discount rules: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, [ownerId, ownerParam]);

  useEffect(() => {
    if (open) loadData();
  }, [open, loadData]);

  // The wildcard rule (product_group = null)
  const wildcardRule = rules.find((r) => r.productGroupId === null);
  // Product-group-specific rules
  const specificRules = rules.filter((r) => r.productGroupId !== null);

  // Product groups that don't yet have a rule
  const availableProductGroups = productGroups.filter(
    (pg) => !specificRules.some((r) => r.productGroupId === pg.productGroupId),
  );

  const handleSaveWildcard = async (value: string) => {
    try {
      if (wildcardRule) {
        await api.discountMatrixControllerUpdate(wildcardRule.discountMatrixId, {
          discountPercentage: value,
        });
      } else {
        await api.discountMatrixControllerCreate({
          customerGroupId: customerGroupId || undefined,
          customerId: customerId || undefined,
          discountPercentage: value,
        });
      }
      toast.success(t('toasts.saved'));
      loadData();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleSaveSpecific = async (ruleId: string, value: string) => {
    try {
      await api.discountMatrixControllerUpdate(ruleId, {
        discountPercentage: value,
      });
      toast.success(t('toasts.saved'));
      loadData();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleAdd = async () => {
    if (!newDiscount) return;
    try {
      await api.discountMatrixControllerCreate({
        customerGroupId: customerGroupId || undefined,
        customerId: customerId || undefined,
        productGroupId: newProductGroupId || undefined,
        discountPercentage: newDiscount,
      });
      toast.success(t('toasts.saved'));
      setNewProductGroupId('');
      setNewDiscount('');
      loadData();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleDelete = async (ruleId: string) => {
    try {
      await api.discountMatrixControllerDelete(ruleId);
      toast.success(t('toasts.deleted'));
      loadData();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  return (
    <SlideOver
      isOpen={open}
      onClose={onClose}
      title={t('title')}
      subtitle={ownerLabel}
    >
      <div className="flex flex-col gap-8">
        {loading ? (
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            {tCommon('loading')}
          </p>
        ) : (
          <>
            {/* Wildcard (Base) Discount */}
            <div>
              <label
                className="text-xs font-semibold mb-2 block"
                style={{
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                {t('baseDiscount')}
              </label>
              <div className="flex gap-2 items-center">
                <div className="relative">
                  <input
                    className="input pr-6"
                    style={{ width: 100 }}
                    type="number"
                    step="0.01"
                    defaultValue={wildcardRule?.discountPercentage ?? '0'}
                    onBlur={(e) => handleSaveWildcard(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter')
                        handleSaveWildcard((e.target as HTMLInputElement).value);
                    }}
                  />
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-medium text-gray-500">%</span>
                </div>
              </div>
            </div>

            {/* Product Group Rules */}
            <div>
              <label
                className="text-xs font-semibold mb-2 block"
                style={{
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                {t('productGroupRules')}
              </label>

              <table className="table-lines w-full text-sm">
                <thead>
                  <tr>
                    <th className="text-left font-semibold text-xs tracking-wider text-gray-500 uppercase">{t('productGroup')}</th>
                    <th className="text-left font-semibold text-xs tracking-wider text-gray-500 uppercase" style={{ width: 120 }}>{t('discountPercent')}</th>
                    <th style={{ width: 60, textAlign: 'right' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {specificRules.map((r) => {
                    const pg = productGroups.find(
                      (p) => p.productGroupId === r.productGroupId,
                    );
                    return (
                      <tr key={r.discountMatrixId}>
                        <td className="font-mono text-xs">
                          {pg ? `${pg.groupCode} — ${pg.name}` : r.productGroupId}
                        </td>
                        <td>
                          <div className="relative">
                            <input
                              className="input pr-6"
                              type="number"
                              step="0.01"
                              defaultValue={r.discountPercentage}
                              style={{ width: 100 }}
                              onBlur={(e) =>
                                handleSaveSpecific(r.discountMatrixId, e.target.value)
                              }
                              onKeyDown={(e) => {
                                if (e.key === 'Enter')
                                  handleSaveSpecific(
                                    r.discountMatrixId,
                                    (e.target as HTMLInputElement).value,
                                  );
                              }}
                            />
                            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-medium text-gray-500">%</span>
                          </div>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <button
                            className="btn btn-ghost btn-xs text-gray-400 hover:text-gray-800"
                            onClick={() => handleDelete(r.discountMatrixId)}
                            title={tCommon('delete')}
                          >
                            {/* eslint-disable i18next/no-literal-string */}
                            <span className="material-symbols-outlined text-base">
                              close
                            </span>
                            {/* eslint-enable i18next/no-literal-string */}
                          </button>
                        </td>
                      </tr>
                    );
                  })}

                  {/* Add new rule row */}
                  {availableProductGroups.length > 0 && (
                    <tr style={{ background: 'var(--bg-secondary)' }}>
                      <td>
                        <select
                          className="input text-xs w-full"
                          value={newProductGroupId}
                          onChange={(e) => setNewProductGroupId(e.target.value)}
                        >
                          <option value="">{t('selectProductGroup')}</option>
                          {availableProductGroups.map((pg) => (
                            <option key={pg.productGroupId} value={pg.productGroupId}>
                              {pg.groupCode} — {pg.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <div className="relative">
                          <input
                            className="input pr-6"
                            type="number"
                            step="0.01"
                            value={newDiscount}
                            onChange={(e) => setNewDiscount(e.target.value)}
                            placeholder="0"
                            style={{ width: 100 }}
                          />
                          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-medium text-gray-500">%</span>
                        </div>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          className="btn btn-primary btn-xs"
                          onClick={handleAdd}
                          disabled={!newProductGroupId || !newDiscount}
                        >
                          {/* eslint-disable i18next/no-literal-string */}
                          <span className="material-symbols-outlined text-base">add</span>
                          {/* eslint-enable i18next/no-literal-string */}
                        </button>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </SlideOver>
  );
}

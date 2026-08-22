import { useState, useEffect } from 'react';
import { Button } from '@/components/shared/Button';
import { InlineSettingsTable } from '@/components/shared/InlineSettingsTable';
import * as api from '@herobm/sdk';
import { toast } from 'react-hot-toast';
import { getErrorMessage } from '@herobm/shared';
import { useTranslations } from 'next-intl';
import ImportTaxModal from '../ImportTaxModal';

export interface TaxCategory {
  [key: string]: unknown;
  taxCategoryId: string;
  code: string;
  title: string;
  type: string;
  rate: string;
}

interface TaxSettingsSectionProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Required for dynamic typing
  appSettings: Record<string, any> | null;
  updateAppSetting: (field: string, value: unknown) => Promise<void>;
}

export function TaxSettingsSection({ appSettings, updateAppSetting }: TaxSettingsSectionProps) {
  const tSettings = useTranslations('admin.settings');
  const tCommon = useTranslations('admin.common');
  
  const [categories, setCategories] = useState<TaxCategory[]>([]);
  const [taxLoading, setTaxLoading] = useState(true);
  const [importTaxModalOpen, setImportTaxModalOpen] = useState(false);

  const loadTax = async () => {
    try {
      setTaxLoading(true);
      const res = await api.taxCategoriesControllerFindAll();
      setCategories((res.data as unknown as TaxCategory[]).sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true })));
    } catch (err: unknown) {
      toast.error(tSettings('toasts.loadFailed', { area: tSettings('sections.tax') }) + ': ' + getErrorMessage(err));
    } finally {
      setTaxLoading(false);
    }
  };

  useEffect(() => {
    loadTax();
  }, []);

  return (
    <>
      <div id="tax-section" className="card relative">
        <div className="flex items-center justify-between mb-6">
          <h3 className="section-heading !mb-0 flex items-center gap-2">
            { }
            {/* eslint-disable-next-line no-restricted-syntax -- Hardcoded string for icon */}
            <span className="material-symbols-outlined">{'payments'}</span>
            {tSettings('sections.tax')}
          </h3>
          <Button variant="secondary" size="sm" onClick={() => setImportTaxModalOpen(true)}>
            {tSettings('actions.importSettings')}
          </Button>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-6 mb-6">
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-[var(--text-muted)]">
              Default Sales Tax
            </label>
            <select 
              className="input max-w-[200px]" 
              value={(appSettings?.defaultSalesTaxCategoryId as string) || ''} 
              onChange={(e) => updateAppSetting('defaultSalesTaxCategoryId', e.target.value)}
            >
              <option value="">{tCommon('notConfigured')}</option>
              {categories.map(c => (
                <option key={c.taxCategoryId} value={c.taxCategoryId}>{c.code} - {c.title} ({Number(c.rate).toFixed(2)}%)</option>
              ))}
            </select>
          </div>
          
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-[var(--text-muted)]">
              Default Purchase Tax
            </label>
            <select 
              className="input max-w-[200px]" 
              value={(appSettings?.defaultPurchaseTaxCategoryId as string) || ''} 
              onChange={(e) => updateAppSetting('defaultPurchaseTaxCategoryId', e.target.value)}
            >
              <option value="">{tCommon('notConfigured')}</option>
              {categories.map(c => (
                <option key={c.taxCategoryId} value={c.taxCategoryId}>{c.code} - {c.title} ({Number(c.rate).toFixed(2)}%)</option>
              ))}
            </select>
          </div>
        </div>

        <InlineSettingsTable
          data={categories || []}
          rowKey={(r: TaxCategory) => r.taxCategoryId}
          onSave={async (row: TaxCategory, isNew: boolean) => {
            if (!row.code || !row.title || !row.type || row.rate === undefined || row.rate === '') {
              throw new Error(tCommon('errors.typeAndDateRequired'));
            }
            const payload = {
              code: row.code.toUpperCase(),
              title: row.title,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Required for dynamic typing
              type: String(row.type) as any,
              rate: String(row.rate),
              exemptionReason: row.exemptionReason ? String(row.exemptionReason) : undefined
            };
            try {
              if (isNew) {
                await api.taxCategoriesControllerCreate(payload);
                toast.success(tSettings('toasts.taxCreated') || 'Tax created');
              } else {
                await api.taxCategoriesControllerUpdate(row.taxCategoryId, payload);
                toast.success(tSettings('toasts.taxUpdated') || 'Tax updated');
              }
              loadTax();
            } catch (err: unknown) {
              toast.error(getErrorMessage(err));
              throw err;
            }
          }}
          onDelete={async (row: TaxCategory) => {
            if (!confirm(tSettings('confirmations.deleteTax', { title: row.title }) || 'Are you sure you want to delete this tax?')) return;
            try {
              await api.taxCategoriesControllerRemove(row.taxCategoryId);
              toast.success(tSettings('toasts.taxDeleted') || 'Tax deleted');
              loadTax();
            } catch (err: unknown) {
              toast.error(getErrorMessage(err));
              throw err;
            }
          }}
          onAdd={() => ({ code: '', title: '', type: 'percentage', rate: 0 } as unknown as TaxCategory)}
          canEdit={() => true}
          canDelete={() => true}
          addLabel={tSettings('actions.create')}
          emptyLabel={tSettings('tax.empty')}
          columns={[
            {
              key: 'code',
              title: tSettings('labels.code'),
              type: 'text',
              width: 120,
              validate: (v: unknown) => v ? null : 'Required'
            },
            {
              key: 'title',
              title: tSettings('labels.title'),
              type: 'text',
              validate: (v: unknown) => v ? null : 'Required'
            },
            {
              key: 'type',
              title: tSettings('labels.type'),
              type: 'select',
              width: 140,
              options: [
                { value: 'percentage', label: tSettings('tax.percentage') || 'Percentage' },
                { value: 'fixed', label: tSettings('tax.fixed') || 'Fixed' },
                { value: 'exempt', label: tSettings('tax.exempt') || 'Exempt' }
              ],
              render: (row: TaxCategory, isEditing: boolean) => {
                if (isEditing) return null;
                return <span className="bg-[var(--bg-secondary)] border border-[var(--border)] px-2 py-0.5 rounded text-xs">{row.type}</span>;
              }
            },
            {
              key: 'rate',
              title: tSettings('labels.rate'),
              type: 'text',
              width: 100,
              validate: (v: unknown) => (v !== '' && v !== null && v !== undefined) ? null : 'Required',
              render: (row: TaxCategory, isEditing: boolean) => {
                if (isEditing) return null;
                return <span>{Number(row.rate).toFixed(2)}</span>;
              }
            }
          ]}
        />
      </div>

      {importTaxModalOpen && (
        <ImportTaxModal
          isOpen={importTaxModalOpen}
          onClose={() => setImportTaxModalOpen(false)}
          onImportComplete={loadTax}
        />
      )}
    </>
  );
}

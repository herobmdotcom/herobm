import { useState, useEffect } from 'react';
import * as api from '@herobm/sdk';
import { toast } from 'react-hot-toast';
import { getErrorMessage } from '@herobm/shared';
import { useTranslations } from 'next-intl';
import { InlineSettingsTable } from '@/components/shared/InlineSettingsTable';

interface TradingTermsSectionProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Required for dynamic typing
  appSettings: Record<string, any> | null;
  updateAppSetting: (field: string, value: unknown) => void;
}

export function TradingTermsSection({ appSettings, updateAppSetting }: TradingTermsSectionProps) {
  const tSettings = useTranslations('admin.settings');
  const tCommon = useTranslations('admin.common');

  const [tradingTerms, setTradingTerms] = useState<api.TradingTermResponseDto[]>([]);
  const [tradingTermsLoading, setTradingTermsLoading] = useState(true);

  const loadTradingTerms = async () => {
    try {
      setTradingTermsLoading(true);
      const res = await api.tradingTermsControllerFindAll();
      setTradingTerms(res.data as unknown as api.TradingTermResponseDto[]);
    } catch (err: unknown) {
      toast.error(tSettings('toasts.loadFailed', { area: tSettings('financialSettings.credit') }) + ': ' + getErrorMessage(err));
    } finally {
      setTradingTermsLoading(false);
    }
  };

  useEffect(() => {
    loadTradingTerms();
  }, []);

  const tradingTermsColumns: import('@/components/shared/InlineSettingsTable').InlineTableColumn<api.TradingTermResponseDto>[] = [
    { key: 'code', title: tSettings('labels.code'), type: 'text', width: '20%' },
    { key: 'description', title: tSettings('labels.description'), type: 'text', width: '30%' },
    { key: 'days', title: tSettings('labels.days'), type: 'number', width: '10%' },
    { key: 'type', title: tSettings('labels.type'), type: 'select', options: [
      { value: 'net', label: tSettings('tradingTerms.types.net') },
      { value: 'end_of_month', label: tSettings('tradingTerms.types.endOfMonth') },
      { value: 'cash_on_delivery', label: tSettings('tradingTerms.types.cashOnDelivery') }
    ], width: '20%' },
  ];

  const handleTradingTermSave = async (row: api.TradingTermResponseDto, isNew: boolean) => {
    try {
      if (!row.code || !row.description || !row.type) {
        toast.error(tSettings('tradingTerms.errors.requiredFields'));
        throw new Error(tSettings('tradingTerms.errors.requiredFields'));
      }
      
      const payload = {
        code: row.code,
        description: row.description,
        days: Number(row.days),
        type: row.type,
      };

      if (isNew) {
        await api.tradingTermsControllerCreate(payload as api.CreateTradingTermDto);
        toast.success(tSettings('toasts.termCreated'));
      } else {
        await api.tradingTermsControllerUpdate(row.tradingTermsId, payload as api.CreateTradingTermDto);
        toast.success(tSettings('toasts.termUpdated'));
      }
      loadTradingTerms();
    } catch (err: unknown) {
      toast.error(getErrorMessage(err));
      throw err;
    }
  };

  const handleTradingTermDelete = async (row: api.TradingTermResponseDto) => {
    if (!confirm(tSettings('tradingTerms.confirmDelete'))) return;
    try {
      await api.tradingTermsControllerDelete(row.tradingTermsId);
      toast.success(tSettings('toasts.termDeleted'));
      loadTradingTerms();
    } catch (err: unknown) {
      toast.error(getErrorMessage(err));
      throw err;
    }
  };

  return (
    <div id="credit-policy" className="card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="section-heading !mb-0">
          {''}
          {/* eslint-disable-next-line no-restricted-syntax -- Complex settings state or UI Icon */}
          <span className="material-symbols-outlined">{'policy'}</span>
          {''}
          <span>{tSettings('financialSettings.credit')}</span>
        </h3>
      </div>
      <div className="flex flex-col gap-1 mb-6">
        <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
          {''}
          {tSettings('financialSettings.creditLimitBehavior')}
        </label>
        <select 
          className="input max-w-sm" 
          value={(appSettings?.creditLimitBehavior as string) || 'hard'} 
          onChange={(e) => updateAppSetting('creditLimitBehavior', e.target.value)}
        >
          {''}
          <option value="hard">{tSettings('financialSettings.hardBlock')}</option>
          {''}
          <option value="soft">{tSettings('financialSettings.softWarning')}</option>
        </select>
      </div>

      <div className="flex gap-8 mb-6">
        <div className="flex flex-col gap-1 flex-1 max-w-sm">
          <label className="text-xs font-medium text-[var(--text-muted)]">
            {tSettings('labels.defaultCustomerTerms')}
          </label>
          <select
            className="input"
             
            value={(appSettings?.defaultCustomerTermsId as string) || ''}
            onChange={(e) => updateAppSetting('defaultCustomerTermsId', e.target.value)}
          >
            <option value="">{tCommon('notConfigured')}</option>
            {tradingTerms.map(t => (
              <option key={t.tradingTermsId} value={t.tradingTermsId}>{t.code} - {t.description}</option>
            ))}
          </select>
        </div>
        
        <div className="flex flex-col gap-1 flex-1 max-w-sm">
          <label className="text-xs font-medium text-[var(--text-muted)]">
            {tSettings('labels.defaultSupplierTerms')}
          </label>
          <select
            className="input"
             
            value={(appSettings?.defaultSupplierTermsId as string) || ''}
            onChange={(e) => updateAppSetting('defaultSupplierTermsId', e.target.value)}
          >
            <option value="">{tCommon('notConfigured')}</option>
            {tradingTerms.map(t => (
              <option key={t.tradingTermsId} value={t.tradingTermsId}>{t.code} - {t.description}</option>
            ))}
          </select>
        </div>
      </div>
      
      <div className="mb-2">
        {tradingTermsLoading ? (
          <div className="animate-pulse flex space-x-4">
            <div className="flex-1 space-y-4 py-1">
              <div className="h-4 bg-[var(--border)] rounded w-3/4"></div>
              <div className="space-y-2">
                <div className="h-4 bg-[var(--border)] rounded"></div>
                <div className="h-4 bg-[var(--border)] rounded w-5/6"></div>
              </div>
            </div>
          </div>
        ) : (
          <InlineSettingsTable
            columns={tradingTermsColumns}
            data={tradingTerms}
            rowKey={(row) => row.tradingTermsId}
            onSave={handleTradingTermSave}
            onDelete={handleTradingTermDelete}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Complex settings state or UI Icon
            onAdd={() => ({ tradingTermsId: '', code: '', description: '', days: 0, type: 'net' } as any)}
            addLabel={tSettings('actions.create')}
            emptyLabel={tSettings('tradingTerms.empty')}
          />
        )}
      </div>
    </div>
  );
}

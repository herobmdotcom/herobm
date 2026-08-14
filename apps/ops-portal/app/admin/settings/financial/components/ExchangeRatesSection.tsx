import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/shared/Button';
import { InlineSettingsTable } from '@/components/shared/InlineSettingsTable';
import * as api from '@herobm/sdk';
import { toast } from 'react-hot-toast';
import { getErrorMessage, CURRENCIES } from '@herobm/shared';
import { useTranslations } from 'next-intl';
import { formatAmount } from '@/lib/currency';
import { formatLocalDate } from '@/lib/date';
import { getCurrency } from '@/lib/currency';
import ExchangeRateHistoryModal from '../ExchangeRateHistoryModal';

export interface ExchangeRate {
  [key: string]: unknown;
  exchangeRateId: string;
  currencyCode: string;
  currencyName: string;
  buyRate: string;
  sellRate: string;
  effectiveDate: string;
  updatedOn: string;
}

interface ExchangeRatesSectionProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Complex settings state
  glSettings: Record<string, any> | null;
  updateGlSetting: (field: string, value: unknown) => void;
}

export function ExchangeRatesSection({ glSettings, updateGlSetting }: ExchangeRatesSectionProps) {
  const tSettings = useTranslations('admin.settings');
  const tCommon = useTranslations('admin.common');

  const [rates, setRates] = useState<ExchangeRate[]>([]);
  const [historyCurrencyCode, setHistoryCurrencyCode] = useState<string | null>(null);

  const loadRates = async () => {
    try {
      const res = await api.exchangeRatesControllerFindAll();
      setRates(res.data as unknown as ExchangeRate[]);
    } catch (err: unknown) {
      toast.error(tSettings('toasts.loadFailed', { area: tSettings('sections.rates') }) + ': ' + getErrorMessage(err));
    }
  };

  useEffect(() => {
    loadRates();
  }, []);

  const ratesWithBase = useMemo(() => {
    // Group by currencyCode and get the latest rate
    const latestRatesMap = new Map<string, ExchangeRate>();
    rates.forEach(r => {
      if (glSettings?.baseCurrency && r.currencyCode === glSettings.baseCurrency) return;
      const existing = latestRatesMap.get(r.currencyCode);
      if (!existing || new Date(r.effectiveDate) > new Date(existing.effectiveDate)) {
        latestRatesMap.set(r.currencyCode, r);
      }
    });
    const latestRates = Array.from(latestRatesMap.values());

    if (!glSettings?.baseCurrency) return latestRates;
    const baseRow = {
      isSystemBase: true,
      currencyCode: String(glSettings.baseCurrency),
      currencyName: getCurrency(String(glSettings.baseCurrency)).name || String(glSettings.baseCurrency),
      effectiveDate: new Date().toISOString(),
      buyRate: '1.0',
      sellRate: '1.0'
    };
    return [baseRow, ...latestRates];
  }, [glSettings, rates]);

  return (
    <>
      <div id="rates-section" className="card relative flex flex-col gap-4">
        <h3 className="section-heading !mb-0 flex items-center gap-2">
          {''}
          {/* eslint-disable-next-line no-restricted-syntax -- Complex settings state or UI Icon */}
          <span className="material-symbols-outlined">{'currency_exchange'}</span>
          {''}
          <span>{tSettings('financialSettings.currencies')}</span>
        </h3>
        
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-[var(--text-muted)]">
            {tSettings('labels.baseCurrency')}
          </label>
          <select 
            className="input max-w-[200px]" 
            value={(glSettings?.baseCurrency as string) || ''} 
            onChange={(e) => updateGlSetting('baseCurrency', e.target.value)}
          >
            <option value="">{tCommon('notConfigured')}</option>
            {CURRENCIES.map(c => (
              <option key={c.code} value={c.code}>{c.code} - {c.name}</option>
            ))}
          </select>
        </div>

        <InlineSettingsTable
          data={ratesWithBase as (ExchangeRate & { isSystemBase?: boolean })[]}
          rowKey={(r: ExchangeRate) => r.exchangeRateId || r.currencyCode}
          onSave={async (row: ExchangeRate, isNew: boolean) => {
            if (!row.currencyCode || !row.buyRate || !row.sellRate) {
              throw new Error(tCommon('errors.typeAndDateRequired'));
            }
            const payload = {
              currencyCode: row.currencyCode.toUpperCase(),
              currencyName: row.currencyName || row.currencyCode.toUpperCase(),
              effectiveDate: isNew ? row.effectiveDate : new Date().toISOString(),
              buyRate: String(row.buyRate),
              sellRate: String(row.sellRate)
            };
            if (isNew) {
              await api.exchangeRatesControllerCreate(payload);
              toast.success(tSettings('toasts.rateCreated') || 'Rate created');
            } else {
              await api.exchangeRatesControllerCreate(payload);
              toast.success(tSettings('toasts.rateUpdated') || 'New rate added to history');
            }
            loadRates();
          }}
          extraActions={(row: ExchangeRate & { isSystemBase?: boolean }) => {
            if (row.isSystemBase) return null;
            return (
              <Button 
                variant="secondary" size="xs" className="ml-2" 
                onClick={() => setHistoryCurrencyCode(row.currencyCode)}
              >
                History
              </Button>
            );
          }}
          onAdd={() => ({ currencyCode: '', currencyName: '', effectiveDate: new Date().toISOString().split('T')[0], buyRate: 1.0, sellRate: 1.0 } as unknown as ExchangeRate)}
          canEdit={(row: ExchangeRate & { isSystemBase?: boolean }) => !row.isSystemBase}
          canDelete={() => false}
          addLabel={tSettings('actions.create')}
          emptyLabel={tSettings('rates.empty')}
          columns={[
            {
              key: 'currencyCode',
              title: tSettings('labels.currencyCode'),
              type: 'text',
              width: 100,
              validate: (v: unknown) => v ? null : 'Required',
              render: (row: ExchangeRate & { isSystemBase?: boolean }, isEditing: boolean) => {
                if (isEditing) return null;
                return (
                  <div className="flex flex-col gap-0.5">
                    <span className={row.isSystemBase ? 'font-medium' : ''}>{row.currencyCode}</span>
                    {row.isSystemBase && <span className="text-[10px] uppercase tracking-wider text-muted font-bold opacity-60">BASE</span>}
                  </div>
                );
              }
            },
            {
              key: 'currencyName',
              title: tSettings('labels.currencyName'),
              type: 'text',
              validate: (v: unknown) => v ? null : 'Required'
            },
            {
              key: 'effectiveDate',
              title: tSettings('labels.effectiveDate'),
              type: 'date',
              width: 150,
              validate: (v: unknown) => v ? null : 'Required',
              render: (row: ExchangeRate & { isSystemBase?: boolean }, isEditing: boolean) => {
                if (isEditing) {
                  return (
                    <span className="text-xs italic text-muted">
                      Will be set to today
                    </span>
                  );
                }
                if (row.isSystemBase) return <span className="text-xs italic text-muted">{tSettings('labels.systemBase')}</span>;
                return <span>{formatLocalDate(row.effectiveDate as string)}</span>;
              }
            },
            {
              key: 'buyRate',
              title: tSettings('labels.buyRate'),
              type: 'text',
              width: 110,
              validate: (v: unknown) => (v !== '' && v !== null && v !== undefined) ? null : 'Required'
            },
            {
              key: 'sellRate',
              title: tSettings('labels.sellRate'),
              type: 'text',
              width: 110,
              validate: (v: unknown) => (v !== '' && v !== null && v !== undefined) ? null : 'Required'
            }
          ]}
        />
      </div>

      {historyCurrencyCode && (
        <ExchangeRateHistoryModal
          isOpen={!!historyCurrencyCode}
          onClose={() => setHistoryCurrencyCode(null)}
          currencyCode={historyCurrencyCode}
          rates={rates}
          onSave={async (row, isNew) => {
            const payload = {
              currencyCode: row.currencyCode.toUpperCase(),
              currencyName: row.currencyName || row.currencyCode.toUpperCase(),
              effectiveDate: row.effectiveDate,
              buyRate: String(row.buyRate),
              sellRate: String(row.sellRate)
            };
            if (isNew) {
              await api.exchangeRatesControllerCreate(payload);
              toast.success(tSettings('toasts.rateCreated') || 'Rate created');
            } else {
              await api.exchangeRatesControllerUpdate(row.exchangeRateId, payload);
              toast.success(tSettings('toasts.rateUpdated') || 'Rate updated');
            }
            loadRates();
          }}
        />
      )}
    </>
  );
}

'use client';

import { formatLocalDate, toInputDateFormat, parseLocalDate } from '@/lib/date';
import { useTranslations } from 'next-intl';
import SlideOver from '@/components/shared/SlideOver';
import { InlineSettingsTable } from '@/components/shared/InlineSettingsTable';

interface ExchangeRate {
  exchangeRateId: string;
  currencyCode: string;
  currencyName: string;
  buyRate: string;
  sellRate: string;
  effectiveDate: string;
  updatedOn: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  currencyCode: string;
  rates: ExchangeRate[];
  onSave: (row: ExchangeRate, isNew: boolean) => Promise<void>;
}

export default function ExchangeRateHistoryModal({
  isOpen,
  onClose,
  currencyCode,
  rates,
  onSave
}: Props) {
  const tSettings = useTranslations('admin.settings');
  const tCommon = useTranslations('admin.common');

  // Filter and sort by effectiveDate DESC
  const historyRates = rates
    .filter(r => r.currencyCode === currencyCode)
    .sort((a, b) => new Date(b.effectiveDate).getTime() - new Date(a.effectiveDate).getTime());

  return (
    <SlideOver isOpen={isOpen} onClose={onClose} title={`${tSettings('financialSettings.currencies')} - ${currencyCode} History`} width="max-w-4xl">
      <div className="flex flex-col gap-4 p-4">
        <InlineSettingsTable
          data={historyRates}
          rowKey={(r: ExchangeRate) => r.exchangeRateId}
          onSave={onSave}
          canEdit={() => true}
          canDelete={() => false}
          emptyLabel={tSettings('rates.empty')}
          columns={[
            {
              key: 'effectiveDate',
              title: tSettings('labels.effectiveDate'),
              type: 'date',
              width: 150,
              validate: (v: unknown) => v ? null : 'Required',
              render: (row: ExchangeRate, isEditing: boolean, onChange) => {
                if (isEditing) {
                  return (
                    <input 
                      type="date" 
                      className="input w-full"
                      value={toInputDateFormat(row.effectiveDate)} 
                      onChange={e => onChange?.(parseLocalDate(e.target.value)?.toISOString() || '')} 
                    />
                  );
                }
                return <span>{formatLocalDate(row.effectiveDate)}</span>;
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
    </SlideOver>
  );
}

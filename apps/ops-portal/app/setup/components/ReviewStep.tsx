import { useTranslations } from 'next-intl';
import { ConfigState } from './SetupWizard';

interface Props {
  config: ConfigState;
  onNext: () => void;
}

export default function ReviewStep({ config, onNext }: Props) {
  const t = useTranslations('setup.review');
  const payload = [
    `# ${t('executionPayload')}`,
    `Pipeline: STERILE_INIT`,
    `${t('payload.companyName')}: ${config.companyName}`,
    `${t('payload.coaPreset')}: ${config.coaPreset}`,
    `${t('payload.currency')}: ${config.baseCurrency.split(' ')[0]}`,
    `${t('payload.fiscalStartMonth')}: ${config.fiscalStartMonth}`,
    `${t('payload.valuationStrategy')}: ${config.inventoryValuation || 'weighted_average'}`,
    `${t('payload.billingMode')}: ${config.nonStockBilling || 'per_shipment'}`,
    `${t('payload.defaultFulfillmentLocation')}: ${config.primaryLocation !== 'none' ? config.primaryLocation : t('payload.systemDefault')}`,
    `${t('payload.revenueRouting')}: ${config.revenueRouting.includes('Product') ? 'product_first' : 'customer_first'}`,
    `${t('payload.expenseRouting')}: ${config.expenseRouting.includes('Product') ? 'product_first' : 'supplier_first'}`
  ].join('\n');

  return (
    <div className="flex flex-col h-full animate-in fade-in slide-in-from-right-4 duration-500">
      <div className="flex flex-col items-center justify-center text-center mb-8 mt-4">
        {/* eslint-disable-next-line i18next/no-literal-string */}
        <span className="material-symbols-outlined text-4xl text-[#006b5c] mb-4">check_circle</span>
        <h2 className="text-3xl font-bold text-slate-900 mb-2">{t('title')}</h2>
        <p className="text-slate-500 text-lg">
          {t('description')}
        </p>
      </div>

      <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 font-mono text-sm text-slate-800 whitespace-pre leading-relaxed mb-8 flex-1">
        {payload}
      </div>

      <div className="mt-auto pt-6 flex items-center justify-center border-t border-slate-100">
        <button
          onClick={onNext}
          className="bg-[#006b5c] hover:bg-[#005246] text-white px-8 py-3 rounded-lg font-bold transition-colors shadow-sm"
        >
          {t('confirm')}
        </button>
      </div>
    </div>
  );
}

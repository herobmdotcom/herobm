import { useTranslations } from 'next-intl';
import { ConfigState } from './SetupWizard';

interface Props {
  config: ConfigState;
  onNext: () => void;
}

export default function ReviewStep({ config, onNext }: Props) {
  const t = useTranslations('setup.review');
  const isSsl = config.port === '1433' ? '' : ' // non-standard port';

  const payload = [
    `# Execution Payload`,
    `Pipeline: ${config.emptyBase ? 'STERILE_INIT' : 'ENABLE_DLT_ABM_IMPORT'}`,
    `Source:   ${config.emptyBase ? 'None' : `read_only@${config.host}:${config.port}/${config.database}`}`,
    `Resume:   ${config.resume ? 'ENABLED (Skipping loaded tables)' : 'DISABLED'}`,
    `Company Name: ${config.companyName}`,
    `COA Preset: ${config.coaPreset}`,
    `Currency: ${config.baseCurrency.split(' ')[0]}`,
    `Fiscal Start Month: ${config.fiscalStartMonth}`,
    `Valuation Strategy: ${config.inventoryValuation || 'weighted_average'}`,
    `Billing Mode: ${config.nonStockBilling || 'per_shipment'}`,
    `Primary Location: ${config.primaryLocation !== 'none' ? config.primaryLocation : 'System Default'}`,
    `Revenue Routing: ${config.revenueRouting.includes('Product') ? 'product_first' : 'customer_first'}`,
    `Expense Routing: ${config.expenseRouting.includes('Product') ? 'product_first' : 'supplier_first'}`
  ].join('\n');

  return (
    <div className="flex flex-col h-full animate-in fade-in slide-in-from-right-4 duration-500">
      <div className="flex flex-col items-center justify-center text-center mb-8 mt-4">
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

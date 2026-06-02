const fs = require('fs');

const file = 'c:/Users/Marcel/volz/modbm/modbm/apps/ops-portal/app/admin/settings/financial/page.tsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Fix isDefault render issue (change type to boolean and remove render)
const oldIsDefault = /key: 'isDefault',\s*title: tSettings\('labels\.isDefault'\),\s*type: 'custom',\s*width: 100,\s*render: \([\s\S]*?<\/\div>\n\s*\)/;
content = content.replace(oldIsDefault, "key: 'isDefault', title: tSettings('labels.isDefault'), type: 'boolean', width: 100");

// 2. Fix ratesWithBase
// We will insert `ratesWithBase` after `const [rateCreating, setRateCreating] = useState(false);` if it exists.
// Wait, the regex `const [rates, setRates] = useState<ExchangeRate[]>([]);` is at line 87.
const ratesWithBaseReplacement = `const [rates, setRates] = useState<ExchangeRate[]>([]);
  const ratesWithBase = useMemo(() => {
    if (!glSettings?.baseCurrency) return rates;
    const baseRow = {
      isSystemBase: true,
      currencyCode: glSettings.baseCurrency,
      currencyName: glSettings.baseCurrency,
      effectiveDate: new Date().toISOString(),
      buyRate: 1.0,
      sellRate: 1.0
    };
    return [baseRow, ...rates];
  }, [glSettings, rates]);`;

content = content.replace(/const \[rates, setRates\] = useState<ExchangeRate\[\]>\(\[\]\);/, ratesWithBaseReplacement);

// 3. Fix currencyName payload and add column
const payloadRegex = /const payload = \{\n\s*currencyCode: row\.currencyCode\.toUpperCase\(\),\n\s*effectiveDate: row\.effectiveDate,\n\s*buyRate: row\.buyRate,\n\s*sellRate: row\.sellRate\n\s*\};/;
const payloadReplacement = `const payload = {
                currencyCode: row.currencyCode.toUpperCase(),
                currencyName: row.currencyName || row.currencyCode.toUpperCase(),
                effectiveDate: row.effectiveDate,
                buyRate: row.buyRate,
                sellRate: row.sellRate
              };`;
content = content.replace(payloadRegex, payloadReplacement);

const newRateDefault = /onAdd=\{\(\) => \(\{ currencyCode: '', effectiveDate: new Date\(\)\.toISOString\(\)\.split\('T'\)\[0\], buyRate: 1\.0, sellRate: 1\.0 \} as any\)\}/;
content = content.replace(newRateDefault, `onAdd={() => ({ currencyCode: '', currencyName: '', effectiveDate: new Date().toISOString().split('T')[0], buyRate: 1.0, sellRate: 1.0 } as any)}`);

// Add currencyName column right after currencyCode
const codeColRegex = /key: 'currencyCode',\n\s*title: tSettings\('labels\.currencyCode'\),\n\s*type: 'text',\n\s*width: 100,\n\s*validate: \(v\) => v \? null : 'Required',\n\s*render: \([\s\S]*?\n\s*\}\n\s*\},/;
const codeColReplacement = `key: 'currencyCode',
                title: tSettings('labels.currencyCode'),
                type: 'text',
                width: 100,
                validate: (v) => v ? null : 'Required',
                render: (row: any, isEditing: boolean) => {
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
                validate: (v) => v ? null : 'Required'
              },`;
content = content.replace(codeColRegex, codeColReplacement);

fs.writeFileSync(file, content, 'utf8');
console.log("TS Fix complete");

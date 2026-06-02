const fs = require('fs');
const file = 'c:/Users/Marcel/volz/modbm/modbm/apps/ops-portal/app/admin/settings/financial/page.tsx';
let content = fs.readFileSync(file, 'utf8');

// The replacement text blocks
let newTaxSection = fs.readFileSync('c:/Users/Marcel/volz/modbm/modbm/apps/ops-portal/tax-section.txt', 'utf8');
let newRatesSection = fs.readFileSync('c:/Users/Marcel/volz/modbm/modbm/apps/ops-portal/rates-section.txt', 'utf8');

// Fix the Tax Section isDefault type
newTaxSection = newTaxSection.replace(/type: 'custom',[\s\S]*?render: \([\s\S]*?<\/div>\n\s*\)/, "type: 'boolean' as const");

// Fix the Rates Section currencyName issues
newRatesSection = newRatesSection.replace(/currencyCode: row\.currencyCode\.toUpperCase\(\),\n\s*effectiveDate/, "currencyCode: row.currencyCode.toUpperCase(),\n                currencyName: row.currencyName || row.currencyCode.toUpperCase(),\n                effectiveDate");
newRatesSection = newRatesSection.replace(/onAdd=\{\(\) => \(\{ currencyCode: '', effectiveDate/, "onAdd={() => ({ currencyCode: '', currencyName: '', effectiveDate");
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
newRatesSection = newRatesSection.replace(codeColRegex, codeColReplacement);

// 1. Replace the JSX sections
const taxStart = content.indexOf('{/* ── Tax Categories ─────────────────────────────────────────────── */}');
const ratesStart = content.indexOf('{/* ── Exchange Rates ─────────────────────────────────────────────── */}');
const ccStart = content.indexOf('{/* ── Cost Centers ─────────────────────────────────────────────────── */}');

if (taxStart !== -1 && ratesStart !== -1 && ccStart !== -1) {
    content = content.substring(0, taxStart) + 
              newTaxSection + '\n\n        ' + 
              newRatesSection + '\n\n        ' + 
              content.substring(ccStart);
}

// 2. Add ratesWithBase safely
const ratesStateLine = '  const [rates, setRates] = useState<ExchangeRate[]>([]);';
if (content.includes(ratesStateLine)) {
    const glSettingsDep = `
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
    content = content.replace(ratesStateLine, ratesStateLine + glSettingsDep);
}

// 3. Remove old tax state
const oldTaxState = `  const [taxEditingId, setTaxEditingId] = useState<string | null>(null);
  const [taxForm, setTaxForm] = useState<any>({});
  const [taxCreating, setTaxCreating] = useState(false);`;
content = content.replace(oldTaxState, '');

// 4. Remove old rate state
const oldRateState = `  const [rateEditingId, setRateEditingId] = useState<string | null>(null);
  const [rateForm, setRateForm] = useState<any>({});
  const [rateCreating, setRateCreating] = useState(false);`;
content = content.replace(oldRateState, '');

// 5. Remove functions block
function removeBlock(content, startStr, endStr) {
    const start = content.indexOf(startStr);
    if (start === -1) return content;
    const end = content.indexOf(endStr, start);
    if (end === -1) return content;
    return content.substring(0, start) + content.substring(end + endStr.length);
}

content = removeBlock(content, '  const taxEdit = ', 'toast.success(tSettings(\'toasts.taxCreated\'));\n      }\n      loadTax();\n      taxCancel();\n    } catch (err: unknown) { toast.error(getErrorMessage(err)); }\n  };\n');
content = removeBlock(content, '  const rateEdit = ', 'toast.success(tSettings(\'toasts.rateCreated\'));\n      }\n      loadRates();\n      rateCancel();\n    } catch (err: unknown) { toast.error(getErrorMessage(err)); }\n  };\n');

content = removeBlock(content, '  const renderTaxRow = ', '  );\n\n');
content = removeBlock(content, '  const renderRateRow = ', '  );\n\n');

fs.writeFileSync(file, content, 'utf8');
console.log("Clean refactor complete!");

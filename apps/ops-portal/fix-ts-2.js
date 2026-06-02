const fs = require('fs');

const file = 'c:/Users/Marcel/volz/modbm/modbm/apps/ops-portal/app/admin/settings/financial/page.tsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Move ratesWithBase AFTER const [glSettings, setGlSettings] = useState<any>(null);
const ratesWithBaseBlock = `  const ratesWithBase = useMemo(() => {
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
  }, [glSettings, rates]);\n`;
  
content = content.replace(ratesWithBaseBlock, ''); // remove it from where it currently is
const glSettingsLine = "  const [glSettings, setGlSettings] = useState<any>(null);\n";
content = content.replace(glSettingsLine, glSettingsLine + ratesWithBaseBlock); // add it after glSettings

// 2. Fix the isDefault column that I missed
const oldIsDefault = /key: 'isDefault',\n\s*title: tSettings\('labels\.isDefault'\),\n\s*type: 'custom',\n\s*width: 100,\n\s*render: \([\s\S]*?className=\{isEditing \? '' : 'opacity-70'\}\n\s*\/>\n\s*<\/div>\n\s*\)/;
content = content.replace(oldIsDefault, "key: 'isDefault', title: tSettings('labels.isDefault'), type: 'boolean' as const, width: 100");

fs.writeFileSync(file, content, 'utf8');
console.log("Fix 2 complete");

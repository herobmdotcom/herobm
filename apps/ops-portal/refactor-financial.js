const fs = require('fs');

const file = 'c:/Users/Marcel/volz/modbm/modbm/apps/ops-portal/app/admin/settings/financial/page.tsx';
let content = fs.readFileSync(file, 'utf8');

const newTaxSection = fs.readFileSync('c:/Users/Marcel/volz/modbm/modbm/apps/ops-portal/tax-section.txt', 'utf8');
const newRatesSection = fs.readFileSync('c:/Users/Marcel/volz/modbm/modbm/apps/ops-portal/rates-section.txt', 'utf8');

const taxSectionRegex = /\{\/\* ── Tax Categories ─────────────────────────────────────────────── \*\/\}([\s\S]*?)<\/div>\s*\{\/\* ── Exchange Rates ─────────────────────────────────────────────── \*\/\}/;
const ratesSectionRegex = /\{\/\* ── Exchange Rates ─────────────────────────────────────────────── \*\/\}([\s\S]*?)<\/div>\s*\{\/\* ── Cost Centers ─────────────────────────────────────────────────── \*\/\}/;

let success = false;
if (taxSectionRegex.test(content) && ratesSectionRegex.test(content)) {
    content = content.replace(taxSectionRegex, newTaxSection + '\n\n        {/* ── Exchange Rates ─────────────────────────────────────────────── */}');
    content = content.replace(ratesSectionRegex, newRatesSection + '\n\n        {/* ── Cost Centers ─────────────────────────────────────────────────── */}');
    success = true;
} else {
    console.error("Regex mismatch");
}

const ratesStateRegex = /const \[rates, setRates\] = useState<any\[\]>\(\[\]\);\n  const \[rateLoading, setRateLoading\] = useState\(true\);\n/;
const ratesStateReplacement = `const [rates, setRates] = useState<any[]>([]);
  const [rateLoading, setRateLoading] = useState(true);
  const ratesWithBase = useMemo(() => {
    if (!glSettings?.baseCurrency) return rates;
    const baseRow = {
      isSystemBase: true,
      currencyCode: glSettings.baseCurrency,
      effectiveDate: new Date().toISOString(),
      buyRate: 1.0,
      sellRate: 1.0
    };
    return [baseRow, ...rates];
  }, [glSettings, rates]);\n`;

if (success && content.includes('const [rates, setRates]')) {
    content = content.replace(ratesStateRegex, ratesStateReplacement);
}

// Remove the old manual state and render functions
// Remove taxCreating, taxEditingId, taxForm, rateCreating, rateEditingId, rateForm
const stateToRemove = /  const \[taxCreating, setTaxCreating\] = useState\(false\);\n  const \[taxEditingId, setTaxEditingId\] = useState<string \| null>\(null\);\n  const \[taxForm, setTaxForm\] = useState<any>\(\{\}\);\n\n  const \[rateCreating, setRateCreating\] = useState\(false\);\n  const \[rateEditingId, setRateEditingId\] = useState<string \| null>\(null\);\n  const \[rateForm, setRateForm\] = useState<any>\(\{\}\);\n/;
content = content.replace(stateToRemove, '');

// Remove the tax functions
const taxFunctionsToRemove = /  const taxCreate = \(\) => \{[\s\S]*?loadTax\(\);\n  \};\n/;
content = content.replace(taxFunctionsToRemove, '');

// Remove the rate functions
const rateFunctionsToRemove = /  const rateCreate = \(\) => \{[\s\S]*?loadRates\(\);\n  \};\n/;
content = content.replace(rateFunctionsToRemove, '');

// Remove renderTaxRow and renderRateRow
const renderRowsToRemove = /  const renderTaxRow = \([\s\S]*?<\/tr>\n  \);\n\n  const renderRateRow = \([\s\S]*?<\/tr>\n  \);\n/;
content = content.replace(renderRowsToRemove, '');

fs.writeFileSync(file, content, 'utf8');
console.log("Refactoring complete: " + success);

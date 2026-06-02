const fs = require('fs');
const file = 'c:/Users/Marcel/volz/modbm/modbm/apps/ops-portal/app/admin/settings/financial/page.tsx';
let content = fs.readFileSync(file, 'utf8');

const target = `  const ratesWithBase = useMemo(() => {
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
        result.push({ ...acct, depth });
        if (acct.isGroup) {`;

const replacement = `  const [rateLoading, setRateLoading] = useState(true);

  // ── Cost Centers state ─────────────────────────────────────────────────────
  const [ccs, setCcs] = useState<CostCenter[]>([]);
  const [ccLoading, setCcLoading] = useState(true);

  // ── Activities state ───────────────────────────────────────────────────────
  const [activitiesData, setActivitiesData] = useState<Activity[]>([]);
  const [activityLoading, setActivityLoading] = useState(true);

  // ── GL state ───────────────────────────────────────────────────────────────
  const [glSettings, setGlSettings] = useState<any>(null);
  const [glLoading, setGlLoading] = useState(true);
  const [glAccounts, setGlAccounts] = useState<any[]>([]);
  const [schemaObj, setSchemaObj] = useState<any>({ type: 'object', properties: {} });

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
  }, [glSettings, rates]);

  // ── Chart of Accounts state ────────────────────────────────────────────────
  const [coaEditingId, setCoaEditingId] = useState<string | null>(null);
  const [coaForm, setCoaForm] = useState<any>({});
  const [coaCreating, setCoaCreating] = useState(false);
  const [importCoaModalOpen, setImportCoaModalOpen] = useState(false);

  const coaTree = useMemo(() => {
    const map = new Map<string | null, any[]>();
    for (const acct of glAccounts) {
      const pId = acct.parentAccountId || null;
      if (!map.has(pId)) map.set(pId, []);
      map.get(pId)!.push(acct);
    }
    const build = (parentId: string | null, depth: number = 0): any[] => {
      const children = map.get(parentId) || [];
      const result: any[] = [];
      for (const acct of children) {
        result.push({ ...acct, depth });
        if (acct.isGroup) {`;

content = content.replace(target, replacement);

// And we need to fix the `handleChange` error on line 907
const brokenHandleChange = /render: \(row: any, isEditing: boolean, handleChange: any\) => \([\s\S]*?className=\{isEditing \? '' : 'opacity-70'\}\n\s*\/>\n\s*<\/div>\n\s*\)/;
content = content.replace(brokenHandleChange, "render: (row: any, isEditing: boolean) => (\n                  <div className=\"flex items-center justify-center\">\n                    <input \n                      type=\"checkbox\" \n                      checked={!!row.isDefault} \n                      disabled={!isEditing}\n                      className={isEditing ? '' : 'opacity-70'}\n                    />\n                  </div>\n                )");

fs.writeFileSync(file, content, 'utf8');
console.log("Fix 3 complete");

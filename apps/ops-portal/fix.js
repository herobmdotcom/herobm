const fs = require('fs');
let code = fs.readFileSync('page.tsx.bak', 'utf8');

// 1. folder icon
code = code.replace(
  `{data.isGroup ? <span className="material-symbols-outlined text-[16px]">folder</span> : <span className="material-symbols-outlined text-[16px] text-muted">receipt_long</span>}`,
  `{data.isGroup ? (
                  <>
                    {/* eslint-disable i18next/no-literal-string */}
                    <span className="material-symbols-outlined text-[16px]">folder</span>
                    {/* eslint-enable i18next/no-literal-string */}
                  </>
                ) : (
                  <>
                    {/* eslint-disable i18next/no-literal-string */}
                    <span className="material-symbols-outlined text-[16px] text-muted">receipt_long</span>
                    {/* eslint-enable i18next/no-literal-string */}
                  </>
                )}`
);

// 2. checkmark 1
code = code.replace(
  `) : data.isGroup ? (\n            <span className="material-symbols-outlined text-[16px]" style={{ color: 'var(--text-muted)' }}>check</span>\n          ) : null}`,
  `) : data.isGroup ? (\n            <>\n              {/* eslint-disable i18next/no-literal-string */}\n              <span className="material-symbols-outlined text-[16px]" style={{ color: 'var(--text-muted)' }}>check</span>\n              {/* eslint-enable i18next/no-literal-string */}\n            </>\n          ) : null}`
);

// 3. checkmark 2
code = code.replace(
  `) : data.isBankAccount ? (\n            <span className="material-symbols-outlined text-[16px]" style={{ color: 'var(--text-muted)' }}>check</span>\n          ) : null}`,
  `) : data.isBankAccount ? (\n            <>\n              {/* eslint-disable i18next/no-literal-string */}\n              <span className="material-symbols-outlined text-[16px]" style={{ color: 'var(--text-muted)' }}>check</span>\n              {/* eslint-enable i18next/no-literal-string */}\n            </>\n          ) : null}`
);

// 4. check_circle
code = code.replace(
  `) : data.isDefault ? (\n          <span className="material-symbols-outlined text-[16px]" style={{ color: 'var(--primary)' }}>check_circle</span>\n        ) : null}`,
  `) : data.isDefault ? (\n          <>\n            {/* eslint-disable i18next/no-literal-string */}\n            <span className="material-symbols-outlined text-[16px]" style={{ color: 'var(--primary)' }}>check_circle</span>\n            {/* eslint-enable i18next/no-literal-string */}\n          </>\n        ) : null}`
);

// 5. upload_file and ADV-071
code = code.replace(
  `<span className="material-symbols-outlined text-base">upload_file</span>\n                {tSettings('actions.importSettings') || 'Import Settings'}`,
  `{/* eslint-disable i18next/no-literal-string */}\n                <span className="material-symbols-outlined text-base">upload_file</span>\n                {/* eslint-enable i18next/no-literal-string */}\n                {tSettings('actions.importSettings')}`
);

fs.writeFileSync('app/admin/settings/financial/page.tsx', code);
console.log('File successfully fixed!');

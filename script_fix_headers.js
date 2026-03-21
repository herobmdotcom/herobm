import { promises as fs } from 'fs';
import path from 'path';

async function fixFile(filePath, isAccounts) {
  let content = await fs.readFile(filePath, 'utf-8');

  // Replace header with EntityHeader
  const submitText = isAccounts ? "accounts.buttons.createAccount" : "suppliers.buttons.createSupplier";
  const subtitleText = isAccounts ? "accounts.customerManagement" : "suppliers.management";
  const backRoute = isAccounts ? "/accounts" : "/suppliers";

  const entityHeaderHTML = `      <EntityHeader
        title={t('${submitText}')}
        subtitle={t('${subtitleText}')}
        onBack={() => router.push('${backRoute}')}
        isSaving={submitting}
        isDirty={isValid}
        onSave={handleSubmit}
        saveLabel={t('${submitText}')}
      />
`;

  // We find the <div className="flex items-center justify-between mb-6"> up to the error div.
  // Then we replace both with the EntityHeader.

  const flexHeaderStart = content.indexOf('<div className="flex items-center justify-between mb-6">');
  const errorDivEndString = '</div>\n      )}';
  const errorDivEnd = content.indexOf(errorDivEndString, flexHeaderStart);

  if (flexHeaderStart !== -1 && errorDivEnd !== -1) {
    const startPart = content.substring(0, flexHeaderStart);
    // + errorDivEndString.length + length of whitespace
    const endPart = content.substring(errorDivEnd + errorDivEndString.length).trimStart();
    
    content = startPart + entityHeaderHTML + '\n      ' + endPart;
    await fs.writeFile(filePath, content, 'utf-8');
    console.log("Fixed EntityHeader in " + filePath);
  } else {
    console.log("Could not find blocks in " + filePath);
  }
}

async function run() {
  await fixFile(path.join('c:', 'Users', 'Marcel', 'volz', 'modbm', 'modbm', 'apps', 'ops-portal', 'app', 'accounts', 'new', 'page.tsx'), true);
  await fixFile(path.join('c:', 'Users', 'Marcel', 'volz', 'modbm', 'modbm', 'apps', 'ops-portal', 'app', 'suppliers', 'new', 'page.tsx'), false);
}

run().catch(console.error);

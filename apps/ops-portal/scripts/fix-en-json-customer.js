const fs = require('fs');

const enJsonPath = 'c:/Users/Marcel/volz/modbm/modbm/apps/ops-portal/messages/en.json';
const data = JSON.parse(fs.readFileSync(enJsonPath, 'utf8'));

let modified = false;

// 1. gl.reconciliations
if (data.gl && data.gl.reconciliations) {
  if (data.gl.reconciliations.columns && data.gl.reconciliations.columns.customer) {
    data.gl.reconciliations.columns.glAccount = "Account";
    delete data.gl.reconciliations.columns.customer;
    modified = true;
  }
  if (data.gl.reconciliations.customer) {
    data.gl.reconciliations.glAccount = "Account";
    delete data.gl.reconciliations.customer;
    modified = true;
  }
  // Also check some others like "selectAccount": "Select an customer..."
  if (data.gl.reconciliations.quickAdjustmentForm) {
    if (data.gl.reconciliations.quickAdjustmentForm.selectAccount === "Select an customer...") {
      data.gl.reconciliations.quickAdjustmentForm.selectAccount = "Select an account...";
      modified = true;
    }
    if (data.gl.reconciliations.quickAdjustmentForm.offsetAccount === "Offset Customer") {
      data.gl.reconciliations.quickAdjustmentForm.offsetAccount = "Offset Account";
      modified = true;
    }
    if (data.gl.reconciliations.quickAdjustmentForm.memoPlaceholder === "e.g., Monthly Customer Keeping Fee") {
      data.gl.reconciliations.quickAdjustmentForm.memoPlaceholder = "e.g., Monthly Account Keeping Fee";
      modified = true;
    }
  }
  if (data.gl.reconciliations.reconciliationLabel === "Reconciliation: {customer}") {
    data.gl.reconciliations.reconciliationLabel = "Reconciliation: {glAccount}";
    modified = true;
  }
  if (data.gl.reconciliations.selectAccount === "Select an account...") {
    // fine
  }
}

// 2. gl.generalLedger
if (data.gl && data.gl.generalLedger) {
  if (data.gl.generalLedger.columns && data.gl.generalLedger.columns.customer) {
    data.gl.generalLedger.columns.glAccount = "Account";
    delete data.gl.generalLedger.columns.customer;
    modified = true;
  }
  if (data.gl.generalLedger.allAccounts === "All Customers") {
    data.gl.generalLedger.allAccounts = "All Accounts";
    modified = true;
  }
}

// 3. gl.journalEntries
if (data.gl && data.gl.journalEntries) {
  if (data.gl.journalEntries.columns && data.gl.journalEntries.columns.customer) {
    data.gl.journalEntries.columns.glAccount = "Account";
    delete data.gl.journalEntries.columns.customer;
    modified = true;
  }
}

// 4. Check admin settings which also had "Def. AP Customer"
if (data.admin && data.admin.common) {
  if (data.admin.common.defApAccount === "Def. AP Customer") { data.admin.common.defApAccount = "Def. AP Account"; modified = true; }
  if (data.admin.common.defArAccount === "Def. AR Customer") { data.admin.common.defArAccount = "Def. AR Account"; modified = true; }
  if (data.admin.common.defExpenseAccount === "Def. Expense Customer") { data.admin.common.defExpenseAccount = "Def. Expense Account"; modified = true; }
  if (data.admin.common.defRevAccount === "Def. Revenue Customer") { data.admin.common.defRevAccount = "Def. Revenue Account"; modified = true; }
}
if (data.admin && data.admin.settings) {
  if (data.admin.settings.gl) {
    if (data.admin.settings.gl.loading === "Loading GL customers...") { data.admin.settings.gl.loading = "Loading GL accounts..."; modified = true; }
  }
  if (data.admin.settings.labels) {
    if (data.admin.settings.labels.chartOfAccounts === "Chart of Customers") { data.admin.settings.labels.chartOfAccounts = "Chart of Accounts"; modified = true; }
    // accountName: "Customer Name" -> "Account Name"
    if (data.admin.settings.labels.accountName === "Customer Name") { data.admin.settings.labels.accountName = "Account Name"; modified = true; }
  }
  if (data.admin.settings.placeholders) {
    if (data.admin.settings.placeholders.accountName === "Customer name") { data.admin.settings.placeholders.accountName = "Account name"; modified = true; }
  }
}

if (modified) {
  fs.writeFileSync(enJsonPath, JSON.stringify(data, null, 2), 'utf8');
  console.log('Updated en.json');
} else {
  console.log('No modifications made to en.json');
}

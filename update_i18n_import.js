const fs = require('fs');

const enJsonPath = 'apps/ops-portal/messages/en.json';
const enRaw = fs.readFileSync(enJsonPath, 'utf8');
const en = JSON.parse(enRaw);

if (!en.setup) en.setup = {};
if (!en.setup.dataImport) {
  en.setup.dataImport = {
    title: {
      pending: 'Data Import Staged',
      failed: 'Data Import Failed',
      completed: 'Data Import Complete',
      running: 'Executing Data Import'
    },
    subtitle: {
      pending: 'Your legacy Data Import task is ready to begin. Review extraction settings before confirming.',
      failed: 'The ABM extract-load-transform sequence failed to complete safely.',
      completed: 'Your legacy data has been successfully imported into the HeroBM platform.',
      running: 'Migrating legacy ERP records into HeroBM databases using dbt pipelines...'
    },
    sections: {
      confirmedSettings: 'Confirmed Settings',
      executionOptions: 'Execution Options',
      terminal: 'etl-worker terminal'
    },
    options: {
      resumeModeTitle: 'Resume Mode (Recommended)',
      resumeModeDesc: 'Skip tables that have already been fully extracted successfully and only pull missing tables. This is much faster.',
      tablesCached: '{count} Tables Cached',
      alreadyStaged: 'Already Staged: ',
      fullExtractionTitle: 'Full Extraction',
      fullExtractionDesc: 'Wipe the staging area and pull every single table firmly from scratch. Required if upstream schema changed.'
    },
    buttons: {
      startExecution: 'Start Execution',
      goToDashboard: 'Go to Dashboard',
      retryImport: 'Retry Import',
      returnToDashboard: 'Return to Dashboard'
    },
    errors: {
      criticalError: 'Critical Error: {message}'
    }
  };
}

fs.writeFileSync(enJsonPath, JSON.stringify(en, null, 2));
console.log('en.json updated for data-import');

const fs = require('fs');
const path = require('path');

const filePaths = [
  'c:/Users/Marcel/volz/modbm/modbm/apps/ops-portal/messages/en.json',
  'c:/Users/Marcel/volz/modbm/modbm/apps/ops-portal/messages/de.json'
];

for (const filePath of filePaths) {
  if (!fs.existsSync(filePath)) continue;
  const content = fs.readFileSync(filePath, 'utf8');
  const data = JSON.parse(content);

  if (!data.admin) data.admin = {};
  
  if (!data.admin.integrations) {
    if (filePath.endsWith('en.json')) {
      data.admin.integrations = {
        routingRules: "Routing Rules",
        availableIntegrations: "Available Integrations",
        loadingIntegrations: "Loading integrations...",
        noIntegrationsFound: "No integrations found.",
        externalDataProvider: "External Data Provider",
        configuration: "Configuration",
        saveConfiguration: "Save Configuration",
        testConnection: "Test Connection",
        queryOrPayload: "Query or Payload (JSON)",
        testing: "Testing...",
        runTest: "Run Test",
        testSuccessful: "Test Successful",
        testFailed: "Test Failed"
      };
    } else if (filePath.endsWith('de.json')) {
      data.admin.integrations = {
        routingRules: "Routing-Regeln",
        availableIntegrations: "Verfügbare Integrationen",
        loadingIntegrations: "Integrationen werden geladen...",
        noIntegrationsFound: "Keine Integrationen gefunden.",
        externalDataProvider: "Externer Datenanbieter",
        configuration: "Konfiguration",
        saveConfiguration: "Konfiguration speichern",
        testConnection: "Verbindung testen",
        queryOrPayload: "Abfrage oder Payload (JSON)",
        testing: "Wird getestet...",
        runTest: "Test ausführen",
        testSuccessful: "Test erfolgreich",
        testFailed: "Test fehlgeschlagen"
      };
    }
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    console.log(`Updated ${filePath}`);
  } else {
    console.log(`integrations already exists in ${filePath}`);
  }
}

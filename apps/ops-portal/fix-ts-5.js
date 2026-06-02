const fs = require('fs');
const file = 'c:/Users/Marcel/volz/modbm/modbm/apps/ops-portal/app/admin/settings/financial/page.tsx';
let content = fs.readFileSync(file, 'utf8');

const targetStr = `  const saveSchema = async () => {
    try {
      await updateGlSetting('accountMetadataSchema', schemaObj);
      // Update local settings so the UI updates immediately after save
      setGlSettings({ ...glSettings, accountMetadataSchema: schemaObj });
      setSchemaEditorOpen(false);
    } catch (err) {
      toast.error('Failed to save schema');
    }
  };
      const payload = { ...coaForm };`;

const replacementStr = `  const saveSchema = async () => {
    try {
      await updateGlSetting('accountMetadataSchema', schemaObj);
      // Update local settings so the UI updates immediately after save
      setGlSettings({ ...glSettings, accountMetadataSchema: schemaObj });
      setSchemaEditorOpen(false);
    } catch (err) {
      toast.error('Failed to save schema');
    }
  };

  const coaCancel = () => {
    setCoaEditingId(null);
    setCoaForm({});
    setCoaCreating(false);
  };

  const coaCreate = () => {
    setCoaCreating(true);
    setCoaForm({
      code: '',
      title: '',
      type: 'asset', // default
      parentAccountId: null,
      isGroup: false,
      isReconcilable: false,
      metadata: {}
    });
  };

  const coaSave = async () => {
    try {
      const payload = { ...coaForm };`;

content = content.replace(targetStr, replacementStr);
fs.writeFileSync(file, content, 'utf8');
console.log("Fix 5 complete");

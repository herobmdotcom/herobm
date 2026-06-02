const fs = require('fs');
const file = 'c:/Users/Marcel/volz/modbm/modbm/apps/ops-portal/app/admin/settings/financial/page.tsx';
let content = fs.readFileSync(file, 'utf8');

const targetStr = `      toast.error('Failed to save schema');
    }
  };
      const payload = { ...coaForm };`;

const startIdx = content.indexOf(`      toast.error('Failed to save schema');\n    }\n  };\n      const payload = { ...coaForm };`);
if (startIdx !== -1) {
    const endStr = `  };\n      const payload = { ...coaForm };`;
    const replaceStr = `  };\n\n  const coaCancel = () => {\n    setCoaEditingId(null);\n    setCoaForm({});\n    setCoaCreating(false);\n  };\n\n  const coaCreate = () => {\n    setCoaCreating(true);\n    setCoaForm({\n      code: '',\n      title: '',\n      type: 'asset',\n      parentAccountId: null,\n      isGroup: false,\n      isReconcilable: false,\n      metadata: {}\n    });\n  };\n\n  const coaSave = async () => {\n    try {\n      const payload = { ...coaForm };`;
    content = content.replace(endStr, replaceStr);
} else {
    // try replacing more loosely
    const r = /  \};\n\s*const payload = \{ \.\.\.coaForm \};/g;
    content = content.replace(r, "  };\n\n  const coaCancel = () => {\n    setCoaEditingId(null);\n    setCoaForm({});\n    setCoaCreating(false);\n  };\n\n  const coaCreate = () => {\n    setCoaCreating(true);\n    setCoaForm({\n      code: '',\n      title: '',\n      type: 'asset',\n      parentAccountId: null,\n      isGroup: false,\n      isReconcilable: false,\n      metadata: {}\n    });\n  };\n\n  const coaSave = async () => {\n    try {\n      const payload = { ...coaForm };");
}

fs.writeFileSync(file, content, 'utf8');
console.log("Fix 6 complete");

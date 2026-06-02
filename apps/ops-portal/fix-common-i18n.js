const fs = require('fs');

const filePath = 'c:/Users/Marcel/volz/modbm/modbm/apps/ops-portal/messages/en.json';

if (fs.existsSync(filePath)) {
  const content = fs.readFileSync(filePath, 'utf8');
  const data = JSON.parse(content);

  if (!data.common) data.common = {};
  
  let modified = false;

  if (!data.common.close) { data.common.close = "Close"; modified = true; }
  if (!data.common.configure) { data.common.configure = "Configure"; modified = true; }
  if (!data.common.saving) { data.common.saving = "Saving..."; modified = true; }

  if (modified) {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    console.log(`Updated ${filePath}`);
  } else {
    console.log(`keys already exist in ${filePath}`);
  }
}

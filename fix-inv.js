const fs = require('fs');
const glob = require('glob');

const files = glob.sync('apps/ops-portal/**/*.tsx');

for (const file of files) {
  let content = fs.readFileSync(file, 'utf-8');
  let newContent = content;

  newContent = newContent.replace(/api\.inventoryControllerFindAllLocations\(\)/g, 'api.inventoryControllerFindAllLocations({} as any)');

  if (content !== newContent) {
    fs.writeFileSync(file, newContent, 'utf-8');
    console.log('Fixed', file);
  }
}

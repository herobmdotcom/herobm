const fs = require('fs');
const glob = require('glob');
const path = require('path');

const files = glob.sync('apps/ops-portal/**/*.tsx').concat(glob.sync('apps/ops-portal/**/*.ts'));

let changed = 0;

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  let original = content;

  if (content.includes('inventoryControllerFindAllLocations')) {
    
    // Pattern 1: setLocations((res.data) || [])
    content = content.replace(/setLocations\(\(res\.data\)\s*\|\|\s*\[\]\)/g, 'setLocations((res.data as any)?.data || [])');
    
    // Pattern 2: setLocations(res.data || [])
    content = content.replace(/setLocations\(res\.data\s*\|\|\s*\[\]\)/g, 'setLocations((res.data as any)?.data || [])');
    
    // Pattern 3: setLocations(locsRes.data || [])
    content = content.replace(/setLocations\(locsRes\.data\s*\|\|\s*\[\]\)/g, 'setLocations((locsRes.data as any)?.data || [])');
    
    // Pattern 4: setLocations(locRes.data || [])
    content = content.replace(/setLocations\(locRes\.data\s*\|\|\s*\[\]\)/g, 'setLocations((locRes.data as any)?.data || [])');

    // Pattern 5: const locs = response.data || [];
    content = content.replace(/const locs = response\.data\s*\|\|\s*\[\];/g, 'const locs = (response.data as any)?.data || [];');

    // Pattern 6: setLocations(response.data || [])
    content = content.replace(/setLocations\(response\.data\s*\|\|\s*\[\]\)/g, 'setLocations((response.data as any)?.data || [])');

    // Pattern 7: return res.data;  (in modals)
    if (file.includes('InternalTransferModal') || file.includes('ReallocateModal')) {
      content = content.replace(/return res\.data;/g, 'return (res.data as any)?.data || [];');
    }

    // Pattern 8: setLocations((locsRes.data as unknown as any[]) || [])
    content = content.replace(/setLocations\(\(locsRes\.data as unknown as any\[\]\)\s*\|\|\s*\[\]\)/g, 'setLocations((locsRes.data as any)?.data || [])');

    if (content !== original) {
      fs.writeFileSync(file, content, 'utf8');
      console.log('Fixed', file);
      changed++;
    } else {
      console.log('Skipped', file);
    }
  }
}

console.log(`Changed ${changed} files.`);

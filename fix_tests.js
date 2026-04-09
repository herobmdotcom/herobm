const fs = require('fs');
const glob = require('glob');

const files = glob.sync('apps/api/test/**/*.e2e-spec.ts');
files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  
  let locVarName = 'locationId';
  if (content.includes('validLocationId =')) locVarName = 'validLocationId';
  
  // Replace first matched property in the send object with the fulfillmentLocationId property and the property we matched.
  content = content.replace(/(\.post\('?\/api\/sales-orders'?\)(?:.|\n)*?\.send\(\{)([\s\S]*?)(\n\s*)(lines:|name:|customerId:|stateCode:)/g, '$1$3fulfillmentLocationId: ' + locVarName + ',$3$4');
  
  fs.writeFileSync(file, content);
});
console.log('Done!');

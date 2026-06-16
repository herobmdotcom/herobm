import * as fs from 'fs';
import * as path from 'path';

const testDir = path.join(__dirname, '..');

function processDir(dir: string) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (
      entry.isDirectory() &&
      entry.name !== 'fixtures' &&
      entry.name !== 'utils'
    ) {
      processDir(fullPath);
    } else if (entry.isFile() && fullPath.endsWith('.ts')) {
      processFile(fullPath);
    }
  }
}

function processFile(filePath: string) {
  let content = fs.readFileSync(filePath, 'utf8');
  const original = content;

  let index = 0;
  while (true) {
    // Find the next occurrence of post('/api/sales-orders')
    const postIndex = content.indexOf(`post('/api/sales-orders')`, index);
    const postIndex2 = content.indexOf('post(`/api/sales-orders`)', index);
    let targetPostIndex = -1;
    if (postIndex !== -1 && postIndex2 !== -1)
      targetPostIndex = Math.min(postIndex, postIndex2);
    else if (postIndex !== -1) targetPostIndex = postIndex;
    else targetPostIndex = postIndex2;

    if (targetPostIndex === -1) break;

    // From the post, find the next .send({
    const sendIndex = content.indexOf('.send({', targetPostIndex);
    if (sendIndex !== -1 && sendIndex < targetPostIndex + 200) {
      // Find the position right after the {
      const insertPos = sendIndex + '.send({'.length;
      content =
        content.substring(0, insertPos) +
        "\n          deliveryAddressLine1: '123 E2E Street'," +
        content.substring(insertPos);
      index = insertPos + 100; // advance index
    } else {
      index = targetPostIndex + 25;
    }
  }

  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Updated ${filePath}`);
  }
}

processDir(testDir);

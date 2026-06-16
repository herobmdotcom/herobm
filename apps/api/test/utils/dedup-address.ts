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

  // We are looking for cases where deliveryAddressLine1 appears multiple times inside an object literal.
  // The simplest fix is to just use a regex to find duplicate lines within a small window.
  // Actually, since we only injected `deliveryAddressLine1: '123 E2E Street',`, we can just replace multiple occurrences
  // with a single one if they are close, or just run a regex that removes the exact string we injected if the file ALREADY had `deliveryAddressLine1:` somewhere else.
  // Wait, if it has duplicate keys in the SAME object, we can remove the one we added.

  // Let's just remove the first of two consecutive `deliveryAddressLine1:` lines if they are close to each other.
  // Or better, let's find `deliveryAddressLine1: '123 E2E Street',` and remove it if there is another `deliveryAddressLine1:` within 500 characters.

  content = content.replace(
    /deliveryAddressLine1:\s*'123 E2E Street',/g,
    (match, offset, string) => {
      const windowStart = Math.max(0, offset - 200);
      const windowEnd = Math.min(string.length, offset + match.length + 200);
      const window =
        string.substring(windowStart, offset) +
        string.substring(offset + match.length, windowEnd);
      if (window.includes('deliveryAddressLine1:')) {
        // If there is another deliveryAddressLine1 nearby (in the same object payload), we remove our injected one.
        return '';
      }
      return match;
    },
  );

  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Updated ${filePath}`);
  }
}

processDir(testDir);

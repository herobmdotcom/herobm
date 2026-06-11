const fs = require('fs');

const content = fs.readFileSync('any_errors.txt', 'utf-8');
const lines = content.split('\n');

const reasons = {};
for (const line of lines) {
  if (line.startsWith('Reason: ')) {
    const reason = line.replace('Reason: Explicit \'any\' detected in ', '').replace('.', '').trim();
    reasons[reason] = (reasons[reason] || 0) + 1;
  }
}

const sorted = Object.entries(reasons).sort((a, b) => b[1] - a[1]);
for (const [reason, count] of sorted) {
  console.log(`${count.toString().padStart(4, ' ')} - ${reason}`);
}

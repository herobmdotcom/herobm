const fs = require('fs');
const { execSync } = require('child_process');
const path = require('path');

const ps1Files = execSync('git ls-files --deleted | findstr "\\.ps1"').toString().trim().split('\n');
const outputFile = 'C:/Users/Marcel/.gemini/antigravity/brain/f422dd2c-cba2-4154-980d-f8438d5f00f0/scratch/combined_tests.md';

fs.mkdirSync(path.dirname(outputFile), { recursive: true });

let markdown = '# Test Migration Review\n\n';

for (const ps1 of ps1Files) {
  if (!ps1) continue;
  const tsPath = ps1.replace('.ps1', '.ts');
  const baseName = path.basename(ps1, '.ps1');
  
  markdown += `## ${baseName}\n\n`;
  
  try {
    const ps1Content = execSync(`git show HEAD:${ps1}`).toString();
    markdown += `### PowerShell (${ps1})\n\`\`\`powershell\n${ps1Content}\n\`\`\`\n\n`;
  } catch (e) {
    markdown += `### PowerShell (${ps1})\n*Failed to load*\n\n`;
  }
  
  try {
    if (fs.existsSync(tsPath)) {
      const tsContent = fs.readFileSync(tsPath, 'utf8');
      markdown += `### TypeScript (${tsPath})\n\`\`\`typescript\n${tsContent}\n\`\`\`\n\n`;
    } else {
      markdown += `### TypeScript (${tsPath})\n*File does not exist*\n\n`;
    }
  } catch (e) {
    markdown += `### TypeScript (${tsPath})\n*Failed to load*\n\n`;
  }
}

fs.writeFileSync(outputFile, markdown);
console.log(`Saved to ${outputFile}`);

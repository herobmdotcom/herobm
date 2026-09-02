const { execSync } = require('child_process');
const path = require('path');

const targetPath = process.argv[2] || '.';
const absPath = path.resolve(targetPath);

try {
  // Run depcheck and capture its JSON output
  const output = execSync('npx -y depcheck --json', { 
    cwd: absPath,
    encoding: 'utf-8', 
    stdio: ['pipe', 'pipe', 'ignore'] 
  });
  const result = JSON.parse(output);

  // We strictly only care about missing dependencies (ghost dependencies)
  if (Object.keys(result.missing).length > 0) {
    console.error('\x1b[31m%s\x1b[0m', 'CRITICAL ERROR: Missing dependencies detected!');
    console.error('The following packages are imported but not listed in package.json:');
    for (const [pkg, occurrences] of Object.entries(result.missing)) {
      console.error(`- ${pkg} (used in ${occurrences.length} files)`);
    }
    console.error('\nRun `npm install <package> --save` to fix this.');
    process.exit(1);
  } else {
    console.log('\x1b[32m%s\x1b[0m', 'Dependency check passed: No ghost dependencies found.');
    process.exit(0);
  }
} catch (error) {
  // depcheck exits with code -1 or 1 if it finds ANY issues (including purely unused ones)
  // Which is why it throws an error in execSync. We need to parse error.stdout which contains the JSON.
  if (error.stdout) {
    try {
      const result = JSON.parse(error.stdout);
      if (Object.keys(result.missing).length > 0) {
// Actually wait, catch block error.stdout has the json, we don't execSync again in catch.
        console.error('\x1b[31m%s\x1b[0m', `CRITICAL ERROR in ${targetPath}: Missing dependencies detected!`);
        console.error('The following packages are imported but not listed in package.json:');
        for (const [pkg, occurrences] of Object.entries(result.missing)) {
          console.error(`- ${pkg} (used in ${occurrences.length} files)`);
        }
        console.error('\nRun `npm install <package> --save` to fix this.');
        process.exit(1);
      } else {
        console.log('\x1b[32m%s\x1b[0m', 'Dependency check passed: No ghost dependencies found.');
        process.exit(0);
      }
    } catch (parseError) {
      console.error('Failed to parse depcheck output:', parseError);
      process.exit(1);
    }
  } else {
    console.error('Failed to run depcheck:', error.message);
    process.exit(1);
  }
}

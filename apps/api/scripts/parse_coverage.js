const fs = require('fs');
const data = JSON.parse(fs.readFileSync('coverage/coverage-summary.json', 'utf8'));

const files = Object.entries(data)
  .filter(([k, v]) => k !== 'total')
  .map(([file, cov]) => {
    // Get file relative path
    const relativePath = file.substring(file.indexOf('src'));
    return {
      file: relativePath,
      stmts: cov.statements.pct,
      lines: cov.lines.pct,
      funcs: cov.functions.pct,
      branches: cov.branches.pct
    }
  })
  .sort((a, b) => a.lines - b.lines)
  .slice(0, 15);

const output = ['Top files by lowest line coverage:'];
files.forEach(f => {
  output.push(`${f.file}: ${f.lines}% (Stmts: ${f.stmts}%, Funcs: ${f.funcs}%, Branches: ${f.branches}%)`);
});

fs.writeFileSync('coverage/top_lowest_coverage.txt', output.join('\n'));

const fs = require('fs');
const path = require('path');

const srcDir = path.join(process.cwd(), 'apps', 'api', 'src');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    file = path.resolve(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(file));
    } else if (file.endsWith('.spec.ts')) {
      results.push(file);
    }
  });
  return results;
}

const specFiles = walk(srcDir);

specFiles.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let original = content;

  // Replace { provide: DRIZZLE, useValue: db } with pg.db if setupPgliteSuite is used
  if (content.includes('setupPgliteSuite') && content.includes('{ provide: DRIZZLE, useValue: db }')) {
    content = content.replace(/{ provide: DRIZZLE, useValue: db }/g, '{ provide: DRIZZLE, useValue: pg.db }');
  }

  // Replace standalone db. with pg.db. if setupPgliteSuite is used
  // But be careful not to replace pg.db. with pg.pg.db.
  // Match db.insert, db.select, db.delete, db.update, db.execute
  if (content.includes('setupPgliteSuite')) {
    // Negative lookbehind for 'pg.' or 'this.' or 'service.' or 'const ' or 'let ' or 'var '
    // Since JS regex support is limited, we'll use a more surgical approach
    
    const dbOps = ['insert', 'select', 'delete', 'update', 'execute', 'query'];
    dbOps.forEach(op => {
      // Matches ' db.insert' or '(db.insert' but not 'pg.db.insert'
      const regex = new RegExp(`([^\\w\\.])db\\.${op}`, 'g');
      content = content.replace(regex, `$1pg.db.${op}`);
      
      // Matches 'await db.insert'
      const regexAwait = new RegExp(`await db\\.${op}`, 'g');
      content = content.replace(regexAwait, `await pg.db.${op}`);
    });
  }

  if (content !== original) {
    fs.writeFileSync(file, content);
    console.log(`Fixed: ${path.relative(process.cwd(), file)}`);
  }
});

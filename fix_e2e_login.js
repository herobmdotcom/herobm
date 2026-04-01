const fs = require('fs');
const path = require('path');

const testDir = path.join(__dirname, 'apps/api/test');

function processFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');
    let changed = false;

    // We're looking for patterns where `xyzToken = xyzRes.body.access_token;`
    // is set, and we want to ensure there is a throw if status !== 201.
    // Instead of parsing perfectly, let's just use regex to find:
    // const <name>Res = await request(app.getHttpServer())\n      .post('/api/auth/login')...
    // AND the subsequent assignment `<name>Token = <name>Res.body.access_token`
    // We will replace `if (<name>Res.status !== 201) { ... }` or insert our own before the assignment.
    
    // Actually, a simpler regex:
    // Let's find all instances of `([a-zA-Z0-9_]+Token) = ([a-zA-Z0-9_]+Res)\.body\.access_token;`
    // and make sure it is preceded by a strict check.
    
    const regex = /([a-zA-Z0-9_]+Token)\s*=\s*([a-zA-Z0-9_]+Res)\.body\.access_token;/g;
    
    // First, let's remove existing `if (xyzRes.status !== 201) { console.error... }` blocks 
    // to avoid double checks.
    // This regex looks for `if (someRes.status !== 201) { ... }`
    const errorLogRegex = /if\s*\(\w+Res\.status\s*!==\s*201\)\s*\{\s*console\.error\([^;]+\);\s*\}/g;
    content = content.replace(errorLogRegex, '');
    
    content = content.replace(regex, (match, tokenVar, resVar) => {
        changed = true;
        return `if (${resVar}.status !== 201) {
      throw new Error(\`\${'${resVar}'} login failed: \${${resVar}.status} \${JSON.stringify(${resVar}.body)}\`);
    }
    ${match}`;
    });
    
    if (changed) {
        // format nicely if needed, or just leave it
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`Updated ${filePath}`);
    }
}

function walkInfoDir(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            walkInfoDir(fullPath);
        } else if (fullPath.endsWith('.e2e-spec.ts')) {
            processFile(fullPath);
        }
    }
}

walkInfoDir(testDir);

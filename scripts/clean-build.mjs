import fs from 'node:fs';
import path from 'node:path';

const isDirTarget = (name) => ['node_modules', '.next', 'dist'].includes(name);
const isFileTarget = (name) => name.endsWith('.tsbuildinfo');

function cleanRecursively(dir) {
    if (!fs.existsSync(dir)) return;
    let entries;
    try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch (e) {
        return; // Ignore permission errors
    }

    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            if (entry.name === '.git') continue; // Don't search inside .git
            
            if (isDirTarget(entry.name)) {
                try {
                    fs.rmSync(fullPath, { recursive: true, force: true });
                } catch (e) {
                    console.log(`\x1b[33mFailed to cleanly remove ${fullPath}, moving on...\x1b[0m`);
                }
            } else {
                cleanRecursively(fullPath);
            }
        } else if (entry.isFile()) {
            if (isFileTarget(entry.name)) {
                try {
                    fs.rmSync(fullPath, { force: true });
                } catch (e) {}
            }
        }
    }
}

console.log('\x1b[36mNuking Next.js cache, NestJS dist, and node_modules...\x1b[0m');
cleanRecursively(process.cwd());
console.log('\x1b[32mWorkspace cache clean.\x1b[0m');

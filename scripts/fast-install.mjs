import { execSync } from 'node:child_process';
import os from 'node:os';
import fs from 'node:fs';

const isWindows = os.platform() === 'win32';

function run(cmd) {
    console.log(`\x1b[36m> ${cmd}\x1b[0m`);
    execSync(cmd, { stdio: 'inherit' });
}

console.log('\x1b[36mStarting Fast Install Sequence...\x1b[0m');

if (isWindows) {
    run('powershell -ExecutionPolicy Bypass -File scripts\\setup.ps1 -SkipRun');
    // Refresh PATH in case make or other tools were just installed
    const newPath = execSync('powershell -NoProfile -Command "[System.Environment]::GetEnvironmentVariable(\'Path\',\'Machine\') + \';\' + [System.Environment]::GetEnvironmentVariable(\'Path\',\'User\')"').toString().trim();
    process.env.PATH = newPath;
} else {
    run('bash scripts/setup.sh');
}

run('make init-env');
run('make install-npm');
run('make up-db');
run('make init-db');
run('make migrate');
run('make bootstrap');

if (fs.existsSync('.startup_choice')) {
    const choice = fs.readFileSync('.startup_choice', 'utf-8').trim();
    run(`make ${choice}`);
    fs.unlinkSync('.startup_choice');
} else {
    run('make up');
}

console.log('\x1b[32mFast Install Complete!\x1b[0m');

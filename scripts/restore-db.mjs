import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

const rawArgs = process.argv.slice(2);
let backupFile = '';
let profile = '';

for (let i = 0; i < rawArgs.length; i++) {
    const arg = rawArgs[i];
    if (arg === '-p' || arg === '--profile' || arg === '-Profile' || arg === '-TargetProfile' || arg === '--target-profile') {
        profile = rawArgs[++i] || '';
    } else if (!arg.startsWith('-') && !backupFile) {
        backupFile = arg;
    }
}

if (!backupFile) {
    console.error('Error: Backup file path is required.');
    console.error('Usage: node scripts/restore-db.mjs /path/to/backup.sql[.gz] [--profile <name>]');
    process.exit(1);
}

if (!fs.existsSync(backupFile)) {
    console.error(`Error: Backup file '${backupFile}' does not exist.`);
    process.exit(1);
}

let activeProfile = profile;
const activeProfilePath = path.join(rootDir, '.active_profile');
if (!activeProfile && fs.existsSync(activeProfilePath)) {
    activeProfile = fs.readFileSync(activeProfilePath, 'utf8').trim();
}

let envFileName = activeProfile ? `.env.${activeProfile}` : '.env';
let envFilePath = path.join(rootDir, envFileName);

if (fs.existsSync(envFilePath)) {
    const lines = fs.readFileSync(envFilePath, 'utf8').split('\n');
    for (const line of lines) {
        const match = line.match(/^([a-zA-Z_][a-zA-Z0-9_]*)=(.*)/);
        if (match) {
            process.env[match[1]] = match[2].trim().replace(/^['"]|['"]$/g, '');
        }
    }
}

const dbUser = process.env.POSTGRES_USER || 'postgres';
const dbName = process.env.POSTGRES_DB || 'herobm';

console.log('\x1b[36m=========================================\x1b[0m');
console.log('\x1b[97m HEROBM PostgreSQL Database Restore Worker \x1b[0m');
console.log('\x1b[36m=========================================\x1b[0m\n');
console.log(`Target environment: ${envFileName}`);
console.log('Target container  : postgres-custom');
console.log(`Target database   : ${dbName}`);
console.log(`Target user       : ${dbUser}`);
console.log(`Source file       : ${backupFile}\n`);
console.log('\x1b[33mWARNING: This will absolutely overwrite the existing database content inside the container.\x1b[0m');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

rl.question('Are you absolutely sure you want to proceed? [Y/N] ', (answer) => {
    rl.close();
    if (process.stdin.isTTY) {
        try {
            process.stdin.setRawMode(false);
        } catch {}
    }
    try {
        process.stdin.pause();
    } catch {}

    if (!answer.match(/^[Yy]$/)) {
        console.log('\x1b[33mRestore sequence manually aborted.\x1b[0m');
        process.exit(0);
    }

    console.log('\x1b[90mExecuting psql ingestion natively via Podman...\x1b[0m');

    const podman = spawn('podman', ['exec', '-i', 'postgres-custom', 'psql', '-q', '-U', dbUser, '-d', dbName], { shell: process.platform === 'win32' });

    podman.stdin.on('error', (err) => {
        if (err.code !== 'EPIPE') {
            console.error('Stdin error:', err);
        }
    });

    let inputStream = fs.createReadStream(backupFile);
    if (backupFile.endsWith('.gz')) {
        inputStream = inputStream.pipe(zlib.createGunzip());
    }

    inputStream.on('error', (err) => {
        if (err.code !== 'EPIPE') {
            console.error('Input stream error:', err);
        }
    });

    inputStream.pipe(podman.stdin);
    podman.stdout.pipe(process.stdout);
    podman.stderr.pipe(process.stderr);

    podman.on('close', code => {
        if (code === 0) {
            console.log('\x1b[32mRestore successfully completed!\x1b[0m');
        } else {
            console.log(`\x1b[31mRestore finished but reported issues (Exit code ${code}).\x1b[0m`);
        }
        process.exit(code || 0);
    });
});


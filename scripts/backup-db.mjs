import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

const args = process.argv.slice(2);
let profile = "";
for (let i = 0; i < args.length; i++) {
    if (args[i] === '-p' || args[i] === '--profile') {
        profile = args[++i];
    }
}

let envFile = path.join(rootDir, '.env');
const activeProfilePath = path.join(rootDir, '.active_profile');
if (profile) {
    envFile = `${envFile}.${profile}`;
} else if (fs.existsSync(activeProfilePath)) {
    const active = fs.readFileSync(activeProfilePath, 'utf8').trim();
    if (fs.existsSync(`${envFile}.${active}`)) {
        envFile = `${envFile}.${active}`;
    }
}

if (fs.existsSync(envFile)) {
    const lines = fs.readFileSync(envFile, 'utf8').split('\n');
    for (const line of lines) {
        const match = line.match(/^([a-zA-Z_][a-zA-Z0-9_]*)=(.*)/);
        if (match) {
            process.env[match[1]] = match[2].trim().replace(/^['"]|['"]$/g, '');
        }
    }
}

const dbUser = process.env.POSTGRES_USER || 'postgres';
const dbName = process.env.POSTGRES_DB || 'herobm';
const backupRcloneDest = process.env.BACKUP_RCLONE_DEST;

const backupDir = path.join(os.homedir(), 'herobm_backups');
if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });

const timestamp = new Date().toISOString().replace(/T/, '_').replace(/:/g, '').split('.')[0];
const backupFile = path.join(backupDir, `herobm_db_backup_${timestamp}.sql.gz`);

console.log(`\x1b[36m=========================================\x1b[0m`);
console.log(`\x1b[97m HEROBM PostgreSQL Database Backup Worker \x1b[0m`);
console.log(`\x1b[36m=========================================\x1b[0m\n`);
console.log(`Target container : postgres-custom`);
console.log(`Target database  : ${dbName}`);
console.log(`Target user      : ${dbUser}`);
console.log(`Export file      : ${backupFile}\n`);

console.log(`\x1b[90mExecuting pg_dump via Podman and compressing...\x1b[0m`);

const podman = spawn('podman', ['exec', '-i', 'postgres-custom', 'pg_dump', '-U', dbUser, '-d', dbName, '--clean', '--if-exists'], { shell: process.platform === 'win32' });

const fileStream = fs.createWriteStream(backupFile);
const gzip = zlib.createGzip();

podman.stdout.pipe(gzip).pipe(fileStream);

podman.stderr.on('data', data => console.error(data.toString().trim()));

podman.on('close', code => {
    if (code === 0) {
        console.log(`\x1b[32mBackup completed successfully and saved to ${backupFile}!\x1b[0m`);
        handleRclone();
    } else {
        console.error(`\x1b[31mBackup encountered an error.\x1b[0m`);
        process.exit(1);
    }
});

function handleRclone() {
    if (backupRcloneDest) {
        console.log(`\x1b[36mUploading to external storage via rclone (${backupRcloneDest})...\x1b[0m`);
        const rclone = spawn('rclone', ['copy', backupFile, backupRcloneDest], { shell: process.platform === 'win32' });
        rclone.on('close', c => {
            if (c === 0) console.log(`\x1b[32mUpload to external storage complete.\x1b[0m`);
            else console.log(`\x1b[31mUpload failed.\x1b[0m`);
            cleanup();
        });
        rclone.on('error', () => {
            console.log(`\x1b[33mWARNING: rclone is not installed or failed to run. Skipping external upload.\x1b[0m`);
            cleanup();
        });
    } else {
        console.log(`\x1b[90mInfo: BACKUP_RCLONE_DEST not set in .env. Skipping external upload.\x1b[0m`);
        cleanup();
    }
}

function cleanup() {
    const retentionDays = 14;
    console.log(`\x1b[90mCleaning up local backups older than ${retentionDays} days...\x1b[0m`);
    const now = Date.now();
    try {
        const files = fs.readdirSync(backupDir);
        for (const f of files) {
            if (f.startsWith('herobm_db_backup_') && f.endsWith('.sql.gz')) {
                const full = path.join(backupDir, f);
                const stats = fs.statSync(full);
                if (now - stats.mtimeMs > retentionDays * 24 * 60 * 60 * 1000) {
                    fs.unlinkSync(full);
                }
            }
        }
    } catch (e) {
        // ignore
    }
    console.log('Done.');
}

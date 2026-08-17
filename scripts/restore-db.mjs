import { spawn } from 'node:child_process';
import fs from 'node:fs';
import zlib from 'node:zlib';
import readline from 'node:readline';

const backupFile = process.argv[2];

if (!backupFile) {
    console.error('Error: BackupFile path is required.');
    console.error('Usage: node scripts/restore-db.mjs /path/to/backup.sql[.gz]');
    process.exit(1);
}

if (!fs.existsSync(backupFile)) {
    console.error(`Error: Backup file '${backupFile}' does not exist.`);
    process.exit(1);
}

console.log('\x1b[36m=========================================\x1b[0m');
console.log('\x1b[97m HEROBM PostgreSQL Database Restore Worker \x1b[0m');
console.log('\x1b[36m=========================================\x1b[0m\n');
console.log('Target container : postgres-custom');
console.log('Target database  : herobm');
console.log(`Source file      : ${backupFile}\n`);
console.log('\x1b[33mWARNING: This will absolutely overwrite the existing database content inside the container.\x1b[0m');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

rl.question('Are you absolutely sure you want to proceed? [Y/N] ', (answer) => {
    rl.close();
    if (!answer.match(/^[Yy]$/)) {
        console.log('\x1b[33mRestore sequence manually aborted.\x1b[0m');
        process.exit(0);
    }

    console.log('\x1b[90mExecuting psql ingestion natively via Podman...\x1b[0m');

    const podman = spawn('podman', ['exec', '-i', 'postgres-custom', 'psql', '-q', '-U', 'postgres', '-d', 'herobm'], { shell: process.platform === 'win32' });

    let inputStream = fs.createReadStream(backupFile);
    if (backupFile.endsWith('.gz')) {
        inputStream = inputStream.pipe(zlib.createGunzip());
    }

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

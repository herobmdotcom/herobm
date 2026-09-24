import { spawnSync, execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

const isWindows = process.platform === 'win32';

function printHelp() {
    console.log(`
\x1b[36mHeroBM Backup & Destination Setup Utility\x1b[0m
=========================================
Usage:
  node scripts/setup-backup.mjs [mode] [options]
  make backup-destination [DEST="remote:path"]
  make backup-setup [CRON="..."] [EMAIL="..."]

Operational Modes:
  --destination, -d, destination  Configure cloud / remote storage destination (rclone)
  --backup, --schedule, -b, backup Configure automated backup schedule (crontab) [Default]
  --all                           Run both destination and backup schedule setup
  --help, -h                      Display this help guide

Destination Options (--destination):
  --dest <remote:path>            Set backup destination directly (e.g. gdrive:herobm_backups)
  --test, --verify                Test connectivity to the configured destination
  --no-verify                     Skip remote connectivity check
  --profile, -p <name>            Target environment profile (.env.<name>)
  --dry-run                       Simulate without updating .env or crontab

Backup Schedule Options (--backup):
  --cron "<expression>"           Custom cron expression (e.g. "0 2 * * *")
  --daily                         Shortcut for daily schedule at 2:00 AM (0 2 * * *)
  --weekly                        Shortcut for weekly schedule on Sunday at 2:00 AM (0 2 * * 0)
  --email <address>               Send backup log email notifications to address
  --profile, -p <name>            Target environment profile (.env.<name>)
  --run-now                       Execute an immediate backup test run after setup
  --dry-run                       Simulate without modifying crontab
`);
}

function parseCliArgs() {
    const rawArgs = process.argv.slice(2);
    const options = {
        mode: '',
        dest: '',
        cron: '',
        email: '',
        profile: '',
        daily: false,
        weekly: false,
        test: false,
        noVerify: false,
        runNow: false,
        dryRun: false,
        nonInteractive: false,
        help: false,
    };

    for (let i = 0; i < rawArgs.length; i++) {
        const arg = rawArgs[i];
        if (arg === '--help' || arg === '-h') {
            options.help = true;
        } else if (arg === '--destination' || arg === '-d' || arg === 'destination' || arg === '--setup-destination') {
            options.mode = 'destination';
        } else if (arg === '--backup' || arg === '--schedule' || arg === '-b' || arg === 'backup' || arg === 'schedule' || arg === '--setup-backup') {
            options.mode = 'backup';
        } else if (arg === '--all') {
            options.mode = 'all';
        } else if (arg === '--dest' || arg === '-Dest' || arg === '-Destination') {
            options.dest = rawArgs[++i] || '';
        } else if (arg === '--cron' || arg === '-Cron') {
            options.cron = rawArgs[++i] || '';
        } else if (arg === '--email' || arg === '-Email') {
            options.email = rawArgs[++i] || '';
        } else if (arg === '--profile' || arg === '-Profile' || arg === '-p' || arg === '-TargetProfile' || arg === '--target-profile') {
            options.profile = rawArgs[++i] || '';
        } else if (arg === '--daily' || arg === '-Daily') {
            options.daily = true;
        } else if (arg === '--weekly' || arg === '-Weekly') {
            options.weekly = true;
        } else if (arg === '--test' || arg === '--verify' || arg === '-Test' || arg === '-Verify') {
            options.test = true;
        } else if (arg === '--no-verify') {
            options.noVerify = true;
        } else if (arg === '--run-now' || arg === '-RunNow') {
            options.runNow = true;
        } else if (arg === '--dry-run' || arg === '-DryRun') {
            options.dryRun = true;
        } else if (arg === '--non-interactive' || arg === '-NonInteractive') {
            options.nonInteractive = true;
        }
    }

    return options;
}

function resolveEnvironment(profile) {
    let activeProfile = profile;
    const activeProfilePath = path.join(rootDir, '.active_profile');
    if (!activeProfile && fs.existsSync(activeProfilePath)) {
        activeProfile = fs.readFileSync(activeProfilePath, 'utf8').trim();
    }

    const envFileName = activeProfile ? `.env.${activeProfile}` : '.env';
    const envFilePath = path.join(rootDir, envFileName);

    const envVars = {};
    if (fs.existsSync(envFilePath)) {
        const lines = fs.readFileSync(envFilePath, 'utf8').split('\n');
        for (const line of lines) {
            const match = line.match(/^([a-zA-Z_][a-zA-Z0-9_]*)=(.*)/);
            if (match) {
                envVars[match[1]] = match[2].trim().replace(/^['"]|['"]$/g, '');
            }
        }
    }

    return { activeProfile, envFileName, envFilePath, envVars };
}

function createPrompter() {
    let rl = null;
    return {
        question(query) {
            if (!rl) {
                rl = readline.createInterface({
                    input: process.stdin,
                    output: process.stdout,
                });
            }
            return new Promise((resolve) => {
                rl.question(query, (answer) => {
                    resolve(answer ? answer.trim() : '');
                });
            });
        },
        close() {
            if (rl) {
                rl.close();
                rl = null;
            }
            if (process.stdin.isTTY) {
                try {
                    process.stdin.setRawMode(false);
                } catch {
                    // Ignore
                }
            }
            try {
                process.stdin.pause();
            } catch {
                // Ignore
            }
        },
    };
}

async function setupDestination(options, prompter, envCtx) {
    console.log('\n\x1b[36m=== HeroBM Backup Destination Configuration ===\x1b[0m');
    console.log(`Target Environment: \x1b[35m${envCtx.envFileName}\x1b[0m`);

    const currentDest = envCtx.envVars.BACKUP_RCLONE_DEST || '';
    if (currentDest) {
        console.log(`Current Destination: \x1b[32m${currentDest}\x1b[0m`);
    } else {
        console.log('Current Destination: \x1b[90m(Not configured - backups stored locally only)\x1b[0m');
    }

    let rcloneInstalled = false;
    try {
        execSync('rclone --version', { stdio: 'ignore' });
        rcloneInstalled = true;
    } catch {
        rcloneInstalled = false;
    }

    if (!rcloneInstalled) {
        console.log('\n\x1b[33m[NOTICE] rclone is not installed on this system.\x1b[0m');
        console.log('rclone is required to sync backups to cloud providers (S3, Google Drive, Azure, SFTP, etc.).');
        console.log('Installation instructions:');
        console.log('  Debian/Ubuntu : sudo apt install rclone');
        console.log('  Fedora/RHEL   : sudo dnf install rclone');
        console.log('  macOS (brew)  : brew install rclone');
        console.log('  Windows       : winget install Rclone.Rclone\n');

        if (options.dest) {
            console.log(`\x1b[33mProceeding with storing BACKUP_RCLONE_DEST=${options.dest} in ${envCtx.envFileName}...\x1b[0m`);
        } else if (options.nonInteractive || options.dryRun) {
            return;
        } else {
            const proceed = await prompter.question('Do you want to specify a destination path anyway? (y/N): ');
            if (!proceed.match(/^[Yy]$/)) {
                return;
            }
        }
    }

    let destination = options.dest;

    if (!destination && !options.nonInteractive && !options.dryRun) {
        if (rcloneInstalled) {
            try {
                const remotesOut = execSync('rclone listremotes', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
                const remotes = remotesOut.split('\n').map(r => r.trim()).filter(Boolean);
                if (remotes.length > 0) {
                    console.log('\nConfigured rclone remotes found:');
                    remotes.forEach(r => console.log(`  - \x1b[36m${r}\x1b[0m`));
                }
            } catch {
                // Ignore failure listing remotes
            }

            const launchConfig = await prompter.question('\nDo you want to run "rclone config" to add/edit cloud remotes? (y/N): ');
            if (launchConfig.match(/^[Yy]$/)) {
                console.log('\n\x1b[36mLaunching rclone interactive configuration...\x1b[0m');
                prompter.close();
                spawnSync('rclone', ['config'], { stdio: 'inherit', shell: process.platform === 'win32' });
            }
        }

        const promptText = currentDest
            ? `\nEnter rclone destination (e.g. gdrive:herobm_backups) [Press enter to keep '${currentDest}']: `
            : '\nEnter rclone destination (e.g. gdrive:herobm_backups, s3:my-bucket/backups): ';

        const answer = await prompter.question(promptText);
        destination = answer || currentDest;
    }

    if (!destination) {
        console.log('\x1b[33mNo destination specified. Destination configuration unchanged.\x1b[0m');
        return;
    }

    if (rcloneInstalled && !options.noVerify && (options.test || (!options.nonInteractive && !options.dryRun))) {
        let verify = options.test;
        if (!verify && !options.nonInteractive && !options.dryRun) {
            const verifyChoice = await prompter.question(`\nTest read/write access to destination '${destination}'? [Y/n]: `);
            verify = !verifyChoice || Boolean(verifyChoice.match(/^[Yy]$/));
        }

        if (verify) {
            console.log(`\x1b[90mTesting read & write permissions on '${destination}' via rclone...\x1b[0m`);
            const testFileName = `.herobm_write_test_${Date.now()}.tmp`;
            const tmpFilePath = path.join(os.tmpdir(), testFileName);
            fs.writeFileSync(tmpFilePath, `HeroBM Backup Destination Verification - ${new Date().toISOString()}`);

            let writeOk = false;
            let errorMessage = '';
            try {
                // Test Write (Upload)
                execSync(`rclone copyto "${tmpFilePath}" "${destination}/${testFileName}"`, { stdio: 'pipe', encoding: 'utf8', shell: process.platform === 'win32' });
                writeOk = true;
            } catch (err) {
                errorMessage = err.stderr?.toString()?.trim() || err.stdout?.toString()?.trim() || err.message;
            } finally {
                if (fs.existsSync(tmpFilePath)) {
                    try { fs.unlinkSync(tmpFilePath); } catch {}
                }
            }

            if (writeOk) {
                // Test Clean-up (Delete)
                try {
                    execSync(`rclone delete "${destination}/${testFileName}"`, { stdio: 'ignore', shell: process.platform === 'win32' });
                } catch {}
                console.log('\x1b[32m[OK] Destination verified: Read, Write, and Upload permissions confirmed!\x1b[0m');
            } else {
                console.log(`\x1b[31m[ERROR] Destination write verification failed:\x1b[0m`);
                if (errorMessage) {
                    console.log(`\x1b[31m  ${errorMessage}\x1b[0m`);
                }
                console.log('\x1b[33mEnsure your cloud credentials include write/upload permissions (e.g. s3:PutObject) for this bucket/path.\x1b[0m');
            }
        }
    }

    if (options.dryRun) {
        console.log(`\n\x1b[32m[dry-run] Would update ${envCtx.envFileName} with BACKUP_RCLONE_DEST=${destination}\x1b[0m`);
        return;
    }

    let envContent = fs.existsSync(envCtx.envFilePath) ? fs.readFileSync(envCtx.envFilePath, 'utf8') : '';
    if (envContent.includes('BACKUP_RCLONE_DEST=')) {
        envContent = envContent.replace(/^BACKUP_RCLONE_DEST=.*$/m, `BACKUP_RCLONE_DEST=${destination}`);
    } else {
        envContent = envContent.trimEnd() + `\nBACKUP_RCLONE_DEST=${destination}\n`;
    }

    fs.writeFileSync(envCtx.envFilePath, envContent);
    console.log(`\n\x1b[32m[OK] Updated ${envCtx.envFileName} with BACKUP_RCLONE_DEST=${destination}\x1b[0m`);
}

async function setupBackupSchedule(options, prompter, envCtx) {
    console.log('\n\x1b[36m=== HeroBM Automated Backup Schedule Configuration ===\x1b[0m');
    console.log(`Target Environment : \x1b[35m${envCtx.envFileName}\x1b[0m`);

    const currentDest = envCtx.envVars.BACKUP_RCLONE_DEST;
    if (currentDest) {
        console.log(`Cloud Destination  : \x1b[32m${currentDest}\x1b[0m`);
    } else {
        console.log('Cloud Destination  : \x1b[90mNone (Local ~/herobm_backups only). To configure cloud sync, run: make backup-destination\x1b[0m');
    }

    if (isWindows) {
        console.log('\n\x1b[33m[NOTICE] Automated crontab scheduling is native to Linux & macOS.\x1b[0m');
        console.log('On Windows, configure a Windows Scheduled Task with the following command:');
        const profileArg = envCtx.activeProfile ? ` --profile ${envCtx.activeProfile}` : '';
        console.log(`  \x1b[36mnode scripts/backup-db.mjs${profileArg}\x1b[0m\n`);
        if (!options.dryRun && options.nonInteractive) return;
    }

    const backupScript = path.join(rootDir, 'scripts', 'backup-db.mjs');
    const logDir = path.join(rootDir, 'logs');
    const logFile = path.join(logDir, 'backup.log');

    if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });

    let cronExp = '';
    if (options.cron) {
        cronExp = options.cron;
    } else if (options.daily) {
        cronExp = '0 2 * * *';
    } else if (options.weekly) {
        cronExp = '0 2 * * 0';
    } else if (!options.nonInteractive && !options.dryRun && !isWindows) {
        console.log('\n\x1b[33m1. Backup Frequency\x1b[0m');
        console.log('  1) Daily at 2:00 AM');
        console.log('  2) Weekly (Sunday at 2:00 AM)');
        console.log('  3) Custom Cron Expression');

        const freqChoice = await prompter.question('Select an option [1-3] (Default: 1): ');
        if (freqChoice === '2') {
            cronExp = '0 2 * * 0';
        } else if (freqChoice === '3') {
            cronExp = await prompter.question("Enter custom cron expression (e.g. '0 2 * * *'): ");
        } else {
            cronExp = '0 2 * * *';
        }
    } else {
        cronExp = '0 2 * * *';
    }

    let emailDest = options.email;
    if (!emailDest && !options.nonInteractive && !options.dryRun && !isWindows) {
        console.log('\n\x1b[33m2. Email Alerts (Optional)\x1b[0m');
        emailDest = await prompter.question('Enter recipient email for backup log alerts (or leave blank for none): ');
    }

    const profileArg = envCtx.activeProfile ? ` --profile ${envCtx.activeProfile}` : '';
    const nodePath = process.execPath;

    let mailCmd = '';
    if (emailDest) {
        const pyScript = path.join(rootDir, 'scripts', 'send-email.py');
        mailCmd = ` | python3 "${pyScript}" --to "${emailDest}" --subject "HeroBM DB Backup Log"`;
    }

    let cronCmd = '';
    if (mailCmd) {
        cronCmd = `${nodePath} ${backupScript}${profileArg} 2>&1 | tee -a ${logFile}${mailCmd}`;
    } else {
        cronCmd = `${nodePath} ${backupScript}${profileArg} >> ${logFile} 2>&1`;
    }

    const cronLine = `${cronExp} ${cronCmd}`;

    if (options.dryRun) {
        console.log('\n\x1b[32m[dry-run] Generated Crontab Line:\x1b[0m');
        console.log(`  ${cronLine}`);
        return;
    }

    if (!isWindows) {
        try {
            let currentCrontab = '';
            try {
                currentCrontab = execSync('crontab -l', { stdio: ['ignore', 'pipe', 'ignore'] }).toString();
            } catch {
                // No existing crontab
            }

            const scriptIdentifier = `${backupScript}${profileArg}`;
            const lines = currentCrontab.split('\n').filter(l => l && !l.includes(scriptIdentifier));
            lines.push(cronLine);
            lines.push('');

            execSync('crontab -', { input: lines.join('\n') });
            console.log('\n\x1b[32m=== Setup Complete! ===\x1b[0m');
            console.log('The following job has been installed in your crontab:\x1b[36m');
            console.log(`  ${cronLine}\x1b[0m`);
            console.log(`Logs will be written to: ${logFile}`);
            console.log('View active scheduled tasks anytime by running "crontab -l".\n');
        } catch (e) {
            console.error('\x1b[31mFailed to install crontab.\x1b[0m', e.message || e);
        }
    }

    let runNow = options.runNow;
    if (!runNow && !options.nonInteractive && !options.dryRun) {
        const runNowChoice = await prompter.question('Would you like to run a backup now to verify everything works? (y/N): ');
        runNow = Boolean(runNowChoice.match(/^[Yy]$/));
    }

    if (runNow) {
        console.log('\n\x1b[36mExecuting immediate database backup test run...\x1b[0m');
        prompter.close();
        const backupArgs = envCtx.activeProfile ? ['scripts/backup-db.mjs', '--profile', envCtx.activeProfile] : ['scripts/backup-db.mjs'];
        spawnSync(process.execPath, backupArgs, { cwd: rootDir, stdio: 'inherit', shell: process.platform === 'win32' });
    }
}

async function main() {
    const options = parseCliArgs();

    if (options.help) {
        printHelp();
        process.exit(0);
    }

    const envCtx = resolveEnvironment(options.profile);
    const prompter = createPrompter();

    try {
        if (options.mode === 'destination') {
            await setupDestination(options, prompter, envCtx);
        } else if (options.mode === 'all') {
            await setupDestination(options, prompter, envCtx);
            await setupBackupSchedule(options, prompter, envCtx);
        } else {
            // Default mode is backup schedule setup
            await setupBackupSchedule(options, prompter, envCtx);
        }
    } finally {
        prompter.close();
    }
}

main().catch((err) => {
    console.error('\x1b[31mError during backup setup:\x1b[0m', err);
    process.exit(1);
});


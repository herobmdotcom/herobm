import { spawnSync, execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

const isWindows = process.platform === 'win32';

if (isWindows) {
    console.error('\x1b[31mAutomated backup setup via cron is currently only supported on Linux/macOS.\x1b[0m');
    console.error('Please configure a Windows Scheduled Task manually to run "node scripts/backup-db.mjs".');
    process.exit(1);
}

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const question = (query) => new Promise(resolve => rl.question(query, resolve));

async function main() {
    const envFile = path.join(rootDir, '.env');
    const backupScript = path.join(rootDir, 'scripts', 'backup-db.mjs');
    const logDir = path.join(rootDir, 'logs');
    const logFile = path.join(logDir, 'backup.log');

    if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });

    console.log('\n\x1b[36m=== HEROBM Backup Configuration ===\x1b[0m');
    console.log('This script will help you set up automated, recurring backups for your database.');

    console.log('\n\x1b[33m1. Backup Frequency\x1b[0m');
    console.log('When should the backup run?');
    console.log('  1) Daily at 2:00 AM');
    console.log('  2) Weekly (Sunday at 2:00 AM)');
    console.log('  3) Custom Cron Expression');
    
    const freqChoice = await question('Select an option [1-3]: ');
    let cronExp = "0 2 * * *";
    
    if (freqChoice === '1') cronExp = "0 2 * * *";
    else if (freqChoice === '2') cronExp = "0 2 * * 0";
    else if (freqChoice === '3') cronExp = await question("Enter custom cron expression (e.g. '0 2 * * *'): ");
    else console.log('\x1b[31mInvalid option. Defaulting to Daily.\x1b[0m');

    console.log('\n\x1b[33m2. Cloud Sync (Optional)\x1b[0m');
    const rcloneChoice = await question('Do you want to sync backups to external cloud storage using rclone? (y/N): ');

    if (rcloneChoice.match(/^[Yy]$/)) {
        try {
            execSync('rclone --version', { stdio: 'ignore' });
        } catch (e) {
            console.log('\x1b[33mrclone is not installed.\x1b[0m');
            console.log('Please install it first (e.g. "sudo apt install rclone") and run this script again.');
            process.exit(1);
        }
        
        console.log('\n\x1b[36mTriggering rclone config...\x1b[0m');
        console.log('If you haven\'t configured a remote yet, type "n" for new remote and follow the prompts.');
        spawnSync('rclone', ['config'], { stdio: 'inherit' });

        const rcloneDest = await question('\nEnter the rclone destination (e.g., gdrive:herobm_backups): ');
        
        if (rcloneDest) {
            let envContent = fs.existsSync(envFile) ? fs.readFileSync(envFile, 'utf8') : '';
            if (envContent.includes('BACKUP_RCLONE_DEST=')) {
                envContent = envContent.replace(/^BACKUP_RCLONE_DEST=.*$/m, `BACKUP_RCLONE_DEST=${rcloneDest}`);
            } else {
                envContent += `\nBACKUP_RCLONE_DEST=${rcloneDest}\n`;
            }
            fs.writeFileSync(envFile, envContent);
            console.log(`\x1b[32mUpdated .env with BACKUP_RCLONE_DEST=${rcloneDest}\x1b[0m`);
        }
    }

    console.log('\n\x1b[33m3. Email Alerts (Optional)\x1b[0m');
    const emailDest = await question('Do you want to receive an email with the backup log? (Enter email or leave blank): ');

    let mailCmd = "";
    if (emailDest) {
        const pyScript = path.join(rootDir, 'scripts', 'send-email.py');
        mailCmd = ` | python3 "${pyScript}" --to "${emailDest}" --subject "HeroBM DB Backup Log"`;
    }

    console.log('\n\x1b[33m4. Installing Cron Job\x1b[0m');

    const nodePath = process.execPath;
    let cronCmd = "";
    if (mailCmd) {
        cronCmd = `${nodePath} ${backupScript} 2>&1 | tee -a ${logFile}${mailCmd}`;
    } else {
        cronCmd = `${nodePath} ${backupScript} >> ${logFile} 2>&1`;
    }

    const cronLine = `${cronExp} ${cronCmd}`;

    try {
        let currentCrontab = "";
        try {
            currentCrontab = execSync('crontab -l', { stdio: ['ignore', 'pipe', 'ignore'] }).toString();
        } catch (e) {
            // No crontab for user
        }

        const lines = currentCrontab.split('\n').filter(l => l && !l.includes(backupScript));
        lines.push(cronLine);
        lines.push(''); // newline at EOF

        execSync('crontab -', { input: lines.join('\n') });
        console.log('\n\x1b[32m=== Setup Complete! ===\x1b[0m');
        console.log('The following job has been added to your crontab:\x1b[36m');
        console.log(cronLine + '\x1b[0m');
        console.log(`Logs will be written to: ${logFile}`);
        console.log('You can view your active scheduled tasks anytime by running "crontab -l".\n');
    } catch (e) {
        console.error('\x1b[31mFailed to install crontab.\x1b[0m', e);
    }

    console.log('\n\x1b[33m5. Test Configuration\x1b[0m');
    const runNowChoice = await question('Would you like to run a backup now to verify everything works? (y/N): ');
    if (runNowChoice.match(/^[Yy]$/)) {
        console.log('\n\x1b[36mRunning backup...\x1b[0m');
        spawnSync(process.execPath, [backupScript], { stdio: 'inherit' });
    }

    rl.close();
}

main();

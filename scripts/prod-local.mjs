import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

const args = process.argv.slice(2);
let profile = "";
let enableSwagger = "true";
let enableMcp = "true";

for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '-Profile' || arg === '--profile' || arg === '-p') {
        profile = args[++i];
    } else if (arg === '-WithSwagger' || arg === '--with-swagger') {
        enableSwagger = "true";
    } else if (arg === '-NoSwagger' || arg === '--no-swagger') {
        enableSwagger = "false";
    } else if (arg === '-NoMcp' || arg === '--no-mcp') {
        enableMcp = "false";
    } else if (arg === '-Mcp' || arg === '--mcp') {
        enableMcp = "true";
    }
}

let activeProfile = profile;
const activeProfilePath = path.join(rootDir, '.active_profile');
if (!activeProfile && fs.existsSync(activeProfilePath)) {
    activeProfile = fs.readFileSync(activeProfilePath, 'utf8').trim();
}

let envFile = ".env";
if (activeProfile) {
    envFile = `.env.${activeProfile}`;
    console.log(`\x1b[35mTargeting Environment Profile: ${activeProfile}\x1b[0m`);
} else {
    console.log(`\x1b[35mTargeting Default Environment\x1b[0m`);
}

let apiPort = 3001;
let fePort = 4301;
let workerPort = 9092;

const envVars = { ...process.env, ENV_FILE: envFile, ENABLE_SWAGGER: enableSwagger, ENABLE_MCP: enableMcp };

const envFilePath = path.join(rootDir, envFile);
if (fs.existsSync(envFilePath)) {
    console.log(`\x1b[90mLoading configuration from: ${envFile}\x1b[0m`);
    const lines = fs.readFileSync(envFilePath, 'utf8').split('\n');
    for (const line of lines) {
        const match = line.match(/^([a-zA-Z_][a-zA-Z0-9_]*)=(.*)/);
        if (match) {
            let [, key, value] = match;
            value = value.trim().replace(/^['"]|['"]$/g, '');
            envVars[key] = value;
            if (key === 'API_PORT') apiPort = value;
            if (key === 'FE_PORT') fePort = value;
            if (key === 'WORKER_PORT') workerPort = value;
        }
    }
} else {
    console.log(`\x1b[33mWarning: ${envFile} not found!\x1b[0m`);
}

if (!envVars.PIPELINE_RUNNER_URL) envVars.PIPELINE_RUNNER_URL = 'http://127.0.0.1:8001';
if (!envVars.WEBHOOK_URL) envVars.WEBHOOK_URL = `http://127.0.0.1:${apiPort}/internal/setup/webhook`;

console.log(`\x1b[32mStarting local Prod Environment...\x1b[0m`);
console.log(`\x1b[36mAPI will start on port ${apiPort}\x1b[0m`);
console.log(`\x1b[36mPortal will start on port ${fePort}\x1b[0m`);

function startProcess(name, command, args, extraEnv) {
    const isWindows = process.platform === 'win32';
    const cmd = isWindows ? `${command}.cmd` : command;
    const child = spawn(cmd, args, {
        cwd: rootDir,
        env: { ...envVars, ...extraEnv },
        stdio: 'inherit',
        shell: isWindows
    });
    
    child.on('error', (err) => {
        console.error(`\x1b[31m[${name}] Failed to start: ${err.message}\x1b[0m`);
    });

    return child;
}

const processes = [];

processes.push(startProcess('API', 'npm', ['run', 'start:prod', '-w', 'apps/api'], { 
    PORT: apiPort, 
    PIPELINE_LOG_DIR: path.join(rootDir, 'logs') 
}));

console.log(`\x1b[32mPortal connecting to API at: http://localhost:${apiPort}\x1b[0m`);
processes.push(startProcess('FE', 'npm', ['run', 'start:prod', '-w', 'apps/ops-portal'], { 
    API_URL: `http://localhost:${apiPort}`,
    PORT: fePort
}));

processes.push(startProcess('WORKER', 'npm', ['run', 'start', '-w', 'apps/worker'], { 
    PORT: workerPort 
}));

if (enableMcp === 'true') {
    console.log(`\x1b[36mMCP Server will start in prod mode\x1b[0m`);
    processes.push(startProcess('MCP', 'npm', ['run', 'start', '-w', 'apps/mcp-server'], {}));
}

process.on('SIGINT', () => {
    console.log('\nShutting down...');
    for (const p of processes) {
        p.kill('SIGINT');
    }
    process.exit(0);
});

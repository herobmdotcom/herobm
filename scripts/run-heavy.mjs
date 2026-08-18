import { spawnSync, execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

const args = process.argv.slice(2);
let skipUI = false;
let testName = "";

for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--skip-ui' || arg === '-SkipUI') {
        skipUI = true;
    } else if (arg === '--test' || arg === '-TestName') {
        testName = args[++i];
    }
}

function run(cmd, extraEnv = {}) {
    console.log(`\x1b[36m> ${cmd}\x1b[0m`);
    const isWindows = process.platform === 'win32';
    // Handle cross platform npx
    if (isWindows && cmd.startsWith('npx ')) {
        cmd = cmd.replace('npx ', 'npx.cmd ');
    } else if (isWindows && cmd.startsWith('npm ')) {
        cmd = cmd.replace('npm ', 'npm.cmd ');
    }
    
    try {
        execSync(cmd, { 
            stdio: 'inherit', 
            env: { ...process.env, ...extraEnv },
            cwd: rootDir
        });
        return true;
    } catch (e) {
        return false;
    }
}

console.log('\x1b[33mTearing down any existing test containers to ensure a clean run...\x1b[0m');
run('podman compose -f docker-compose.test.yml -f docker-compose.ui.yml down -v');

console.log('\x1b[36mBuilding isolated test images...\x1b[0m');
run('podman build -t localhost/herobm_api-test:latest -f Dockerfile.api .');
run('podman build -t localhost/herobm_pipeline-test:latest -f Dockerfile.pipeline .');
run('podman build -t localhost/herobm_worker-test:latest -f Dockerfile.worker .');
run('podman build --no-cache --build-arg API_URL=http://custom-api-test:3000 -t localhost/herobm_portal-test:latest -f Dockerfile.portal .');

console.log('\x1b[36mEnsuring network exists...\x1b[0m');
process.env.APP_NETWORK_NAME = 'herobm_app-net';
const hasNet = run('podman network exists herobm_app-net');
if (!hasNet) {
    run('podman network create herobm_app-net');
}

console.log('\x1b[36mBooting up test databases...\x1b[0m');
if (!run('podman compose -f docker-compose.test.yml -f docker-compose.ui.yml up -d postgres-test redis-test maildev-test webhook-catcher')) {
    console.error('\x1b[31mFailed to boot test databases!\x1b[0m');
    process.exit(1);
}

console.log('\x1b[33mWaiting 20 seconds for Postgres and Redis to initialize...\x1b[0m');
const wait1 = Date.now();
while (Date.now() - wait1 < 20000) {}

console.log('\x1b[36mInitializing Test Database...\x1b[0m');
const dbEnv = {
    POSTGRES_CONTAINER: "postgres-test",
    POSTGRES_HOST: "127.0.0.1",
    POSTGRES_PORT: "5434",
    REDIS_HOST: "127.0.0.1",
    REDIS_PORT: "6380"
};

const pyCmd = process.platform === 'win32' ? 'python' : 'python3';
if (!run(`${pyCmd} tools/migrate.py`, dbEnv)) {
    // Fallback if python3 isn't available
    if (process.platform !== 'win32' && !run(`python tools/migrate.py`, dbEnv)) {
        console.error('\x1b[31mFailed to run migrations!\x1b[0m');
        process.exit(1);
    }
}

if (!run('npm run seed:test -w apps/api', dbEnv)) {
    console.error('\x1b[31mFailed to seed test database!\x1b[0m');
    process.exit(1);
}

console.log('\x1b[36mBooting up app containers...\x1b[0m');
if (!run('podman compose -f docker-compose.test.yml -f docker-compose.ui.yml up -d custom-api-test worker-test pipeline-runner-test ops-portal-test')) {
    console.error('\x1b[31mFailed to boot test app containers!\x1b[0m');
    process.exit(1);
}

console.log('\x1b[33mWaiting 15 seconds for apps to initialize...\x1b[0m');
const wait2 = Date.now();
while (Date.now() - wait2 < 15000) {}

let failed = false;

console.log('\x1b[32mRunning heavy tests...\x1b[0m');
if (!testName) {
    if (!run('npx tsx infra/test-utils/run-heavy.ts')) failed = true;
} else {
    if (!run(`npx tsx infra/test-utils/run-single.ts ${testName}`)) failed = true;
}

if (!skipUI) {
    console.log('\x1b[32mRunning UI Playwright tests...\x1b[0m');
    if (!run('npm run test:e2e -w apps/ops-portal', { PORTAL_URL: "http://localhost:4305" })) {
        failed = true;
    }
}

if (failed) {
    console.error('\x1b[31mHeavy tests FAILED! Leaving containers up for debugging.\x1b[0m');
    process.exit(1);
} else {
    console.log('\x1b[33mTearing down test containers to preserve dev-local isolation...\x1b[0m');
    run('podman compose -f docker-compose.test.yml -f docker-compose.ui.yml down -v');
    console.log('\x1b[32mHeavy tests PASSED!\x1b[0m');
    process.exit(0);
}

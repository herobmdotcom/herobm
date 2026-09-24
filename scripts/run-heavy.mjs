import { spawnSync, spawn as nodeSpawn, execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { acquireLock } from '../infra/test-utils/mutex-lock.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

const releaseLock = await acquireLock('test-heavy', { logWait: true });

const args = process.argv.slice(2);
let skipUI = false;
let uiOnly = false;
let testName = "";
let e2eFilter = "";
let noTeardown = false;
let reuseContainers = false;
let skipCrawl = process.env.SKIP_CRAWL === '1' || process.env.SKIP_CRAWL === 'true';

for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--skip-ui' || arg === '-SkipUI') {
        skipUI = true;
    } else if (arg === '--ui-only' || arg === '--only-ui' || arg === '--skip-backend' || arg === '-UIOnly') {
        uiOnly = true;
    } else if (arg === '--test' || arg === '-TestName') {
        testName = args[++i];
    } else if (arg === '--e2e' || arg === '--ui-test' || arg === '-E2E') {
        e2eFilter = args[++i];
    } else if (arg === '--no-teardown' || arg === '--keep-alive') {
        noTeardown = true;
    } else if (arg === '--reuse' || arg === '--no-rebuild') {
        reuseContainers = true;
    } else if (arg === '--skip-crawl' || arg === '--no-crawl' || arg === '-SkipCrawl') {
        skipCrawl = true;
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
        const result = spawnSync(cmd, { 
            stdio: 'inherit', 
            env: { ...process.env, ...extraEnv },
            cwd: rootDir,
            shell: true
        });
        if (result.error) {
            return false;
        }
        return result.status === 0;
    } catch (e) {
        return false;
    }
}

/**
 * Runs a command using async spawn instead of spawnSync.
 * 
 * spawnSync with stdio:'inherit' hangs because Chrome helper/crashpad processes
 * (spawned by system Chrome via channel:'chrome') inherit the parent's fds and
 * keep them open after Playwright exits, so spawnSync never returns.
 * 
 * Even async spawn with shell:true hangs because /bin/sh waits for all its
 * children (including Chrome helpers) before exiting itself.
 * 
 * Fix: spawn the executable directly (no shell wrapper) with piped stdio.
 * Without /bin/sh, when npx exits, it's done — Chrome helper orphans are
 * reparented to PID 1 and don't block us. We pipe stdout/stderr and forward
 * them so test output still appears in the terminal.
 */
function runAsync(cmd, extraEnv = {}) {
    console.log(`\x1b[36m> ${cmd}\x1b[0m`);

    const isWindows = process.platform === 'win32';

    return new Promise((resolve) => {
        let child;
        if (isWindows) {
            child = nodeSpawn(cmd, {
                stdio: ['inherit', 'pipe', 'pipe'],
                env: { ...process.env, ...extraEnv },
                cwd: rootDir,
                shell: true,
            });
        } else {
            // Split command into executable and args (no shell needed on POSIX)
            const parts = cmd.split(/\s+/);
            const executable = parts[0];
            const args = parts.slice(1);

            child = nodeSpawn(executable, args, {
                stdio: ['inherit', 'pipe', 'pipe'],
                env: { ...process.env, ...extraEnv },
                cwd: rootDir,
                shell: false,
            });
        }

        // Forward child output to parent in real-time
        if (child.stdout) child.stdout.pipe(process.stdout);
        if (child.stderr) child.stderr.pipe(process.stderr);

        child.on('close', (code) => {
            resolve(code === 0);
        });

        child.on('error', (err) => {
            console.error(`\x1b[31mFailed to spawn: ${err.message}\x1b[0m`);
            resolve(false);
        });
    });
}

if (!reuseContainers) {
    console.log('\x1b[33mTearing down any existing test containers to ensure a clean run...\x1b[0m');
    run('podman compose -f docker-compose.test.yml -f docker-compose.ui.yml down -v');

    console.log('\x1b[36mBuilding isolated test images...\x1b[0m');
    if (!run('podman build -t localhost/herobm_api-test:latest -f Dockerfile.api .')) {
        console.error('\x1b[31mFailed to build API test image!\x1b[0m');
        releaseLock();
        process.exit(1);
    }
    if (!run('podman build -t localhost/herobm_pipeline-test:latest -f Dockerfile.pipeline .')) {
        console.error('\x1b[31mFailed to build Pipeline test image!\x1b[0m');
        releaseLock();
        process.exit(1);
    }
    if (!run('podman build -t localhost/herobm_worker-test:latest -f Dockerfile.worker .')) {
        console.error('\x1b[31mFailed to build Worker test image!\x1b[0m');
        releaseLock();
        process.exit(1);
    }
    if (!skipUI) {
        if (!run('podman build --build-arg API_URL=http://custom-api-test:3000 -t localhost/herobm_portal-test:latest -f Dockerfile.portal .')) {
            console.error('\x1b[31mFailed to build Portal test image!\x1b[0m');
            releaseLock();
            process.exit(1);
        }
    }

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
    const dbEnvInit = {
        POSTGRES_CONTAINER: "postgres-test",
        POSTGRES_HOST: "127.0.0.1",
        POSTGRES_PORT: "5434",
        REDIS_HOST: "127.0.0.1",
        REDIS_PORT: "6380",
        TEST_RUNNER_URL: "http://127.0.0.1:8005",
        TEST_API_URL: "http://127.0.0.1:3005"
    };

    const pyCmd = process.platform === 'win32' ? 'python' : 'python3';
    if (!run(`${pyCmd} tools/migrate.py`, dbEnvInit)) {
        // Fallback if python3 isn't available
        if (process.platform !== 'win32' && !run(`python tools/migrate.py`, dbEnvInit)) {
            console.error('\x1b[31mFailed to run migrations!\x1b[0m');
            process.exit(1);
        }
    }

    if (!run('npm run seed:test -w apps/api', dbEnvInit)) {
        console.error('\x1b[31mFailed to seed test database!\x1b[0m');
        process.exit(1);
    }

    console.log('\x1b[36mBooting up app containers...\x1b[0m');
    const appContainers = skipUI 
        ? 'custom-api-test worker-test pipeline-runner-test' 
        : 'custom-api-test worker-test pipeline-runner-test ops-portal-test nginx-test';
    if (!run(`podman compose -f docker-compose.test.yml -f docker-compose.ui.yml up -d ${appContainers}`)) {
        console.error('\x1b[31mFailed to boot test app containers!\x1b[0m');
        process.exit(1);
    }

    console.log('\x1b[33mWaiting 15 seconds for apps to initialize...\x1b[0m');
    const wait2 = Date.now();
    while (Date.now() - wait2 < 15000) {}
} else {
    console.log('\x1b[33m[REUSE MODE] Reusing existing running test containers...\x1b[0m');
}

const dbEnv = {
    POSTGRES_CONTAINER: "postgres-test",
    POSTGRES_HOST: "127.0.0.1",
    POSTGRES_PORT: "5434",
    REDIS_HOST: "127.0.0.1",
    REDIS_PORT: "6380",
    TEST_RUNNER_URL: "http://127.0.0.1:8005",
    TEST_API_URL: "http://127.0.0.1:3005"
};

let failed = false;

if (!uiOnly) {
    console.log('\x1b[32mRunning heavy tests...\x1b[0m');
    if (!testName) {
        if (!run('npx tsx infra/test-utils/run-heavy.ts', dbEnv)) failed = true;
    } else {
        if (!run(`npx tsx infra/test-utils/run-single.ts ${testName}`, dbEnv)) failed = true;
    }
}

if (!skipUI) {
    console.log('\x1b[32mRunning UI Playwright tests...\x1b[0m');
    const e2eCmd = e2eFilter 
        ? `npx playwright test --config=apps/ops-portal/playwright.config.ts ${e2eFilter}`
        : 'npx playwright test --config=apps/ops-portal/playwright.config.ts';
    if (!(await runAsync(e2eCmd, { PORTAL_URL: "http://localhost:4305", ...(skipCrawl ? { SKIP_CRAWL: "1" } : {}) }))) {
        failed = true;
    }
}

if (failed) {
    console.error('\x1b[31mHeavy tests FAILED! Leaving containers up for debugging.\x1b[0m');
    releaseLock();
    process.exit(1);
} else {
    if (noTeardown || reuseContainers) {
        console.log('\x1b[33m[KEEP ALIVE] Keeping test containers alive for rapid iteration (use REUSE=1 on next run).\x1b[0m');
    } else {
        console.log('\x1b[33mTearing down test containers to preserve dev-local isolation...\x1b[0m');
        run('podman compose -f docker-compose.test.yml -f docker-compose.ui.yml down -v -t 2');
    }
    console.log('\x1b[32mHeavy tests PASSED!\x1b[0m');
    releaseLock();
    process.exit(0);
}

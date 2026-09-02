import { spawnSync } from 'node:child_process';

function run(cmd) {
    console.log(`\x1b[36m> ${cmd}\x1b[0m`);
    const isWindows = process.platform === 'win32';
    // If command starts with npx, we need npx.cmd on Windows
    let executable = cmd.split(' ')[0];
    let args = cmd.split(' ').slice(1);
    if (isWindows && executable === 'npx') executable = 'npx.cmd';
    
    return spawnSync(executable, args, { stdio: 'inherit', shell: isWindows });
}

console.log('Booting up containerized API and Pipeline Runner for integration tests...');
run('podman compose up -d --no-build herobm-api herobm-pipeline postgres-custom redis-broker');

console.log('Waiting 15 seconds for Postgres and API to initialize...');
const waitTime = 15000;
const start = Date.now();
while (Date.now() - start < waitTime) {
    // block
}

console.log('Running pipeline tests...');
const result = run('npx tsx infra/heavy_tests/test_pipeline_cancellation.ts');
const exitCode = result.status;

console.log('Tearing down containers to preserve dev-local isolation...');
run('podman compose stop herobm-api herobm-pipeline postgres-custom redis-broker');

if (exitCode !== 0) {
    console.error('Pipeline tests FAILED!');
    process.exit(exitCode || 1);
} else {
    console.log('Pipeline tests PASSED!');
    process.exit(0);
}

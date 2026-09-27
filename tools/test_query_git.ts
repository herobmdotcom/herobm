import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import {
  validateGitCommand,
  tokenizeCommandLine,
  parseArgs,
} from './query_git.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ [FAIL] ${message}`);
    process.exit(1);
  }
  console.log(`✅ [PASS] ${message}`);
}

function runTests() {
  console.log('=====================================================');
  console.log('  Testing query_git.ts Read-Only Safety & Whitelisting');
  console.log('=====================================================\n');

  // 1. Tokenizer tests
  console.log('--- Tokenizer Tests ---');
  const tok1 = tokenizeCommandLine('grep -n "hello world" apps/api');
  assert(
    tok1.length === 4 && tok1[0] === 'grep' && tok1[1] === '-n' && tok1[2] === 'hello world' && tok1[3] === 'apps/api',
    'Tokenizes double-quoted arguments with spaces',
  );

  const tok2 = tokenizeCommandLine("ls-files '*.ts' 'packages/**/*.json'");
  assert(
    tok2.length === 3 && tok2[1] === '*.ts' && tok2[2] === 'packages/**/*.json',
    'Tokenizes single-quoted glob arguments',
  );

  // 2. Safe read-only commands should pass validation
  console.log('\n--- Whitelisted Safe Commands ---');
  const safeCommands = [
    ['status'],
    ['status', '-s'],
    ['ls-files', 'apps/api'],
    ['ls-files', '-c', '-m', '-o', '--exclude-standard'],
    ['grep', '-n', 'createMockDb', 'apps/api'],
    ['grep', '-i', '-E', 'class.*Service', 'apps/'],
    ['log', '-n', '5', '--oneline'],
    ['log', 'HEAD~5..HEAD', '--stat'],
    ['diff', '--stat'],
    ['diff', 'HEAD~1', 'Makefile'],
    ['diff', '--cached'],
    ['show', 'HEAD', '--stat'],
    ['blame', '-L', '1,20', 'Makefile'],
    ['branch', '-a'],
    ['branch', '-r'],
    ['branch', '--list', 'feature/*'],
    ['branch', '--show-current'],
    ['tag', '-l', 'v*'],
    ['rev-parse', 'HEAD'],
    ['describe', '--tags', '--always'],
    ['shortlog', '-s', '-n'],
    ['check-ignore', '-v', 'tmp/query.sql'],
    ['cat-file', '-p', 'HEAD:package.json'],
    ['ls-tree', '-r', '--name-only', 'HEAD', 'tools'],
    ['remote', '-v'],
    ['remote', 'show', 'origin'],
    ['remote', 'get-url', 'origin'],
    ['config', '--get', 'user.name'],
    ['config', '-l'],
    ['help'],
    ['version'],
  ];

  for (const cmd of safeCommands) {
    const res = validateGitCommand(cmd);
    assert(res.valid, `Allowed safe command: git ${cmd.join(' ')}`);
  }

  // 3. Mutating commands MUST fail validation
  console.log('\n--- Mutating Subcommands (Strictly Forbidden) ---');
  const forbiddenCommands = [
    ['commit', '-m', 'bad'],
    ['push', 'origin', 'main'],
    ['pull', 'origin', 'main'],
    ['fetch'],
    ['checkout', 'main'],
    ['checkout', '-b', 'new-branch'],
    ['switch', 'main'],
    ['restore', '.'],
    ['reset', '--hard', 'HEAD~1'],
    ['clean', '-fd'],
    ['rm', 'file.ts'],
    ['mv', 'a', 'b'],
    ['merge', 'origin/main'],
    ['rebase', 'origin/main'],
    ['cherry-pick', 'abc1234'],
    ['revert', 'HEAD'],
    ['stash'],
    ['stash', 'pop'],
    ['submodule', 'update'],
    ['apply', 'patch.diff'],
    ['init'],
    ['clone', 'https://github.com/foo/bar.git'],
  ];

  for (const cmd of forbiddenCommands) {
    const res = validateGitCommand(cmd);
    assert(!res.valid, `Forbidden mutating command rejected: git ${cmd.join(' ')}`);
  }

  // 4. Dangerous flags / mutation variants MUST fail validation
  console.log('\n--- Dangerous Options & Subcommand Mutation Variants ---');
  const dangerousVariants = [
    ['diff', '--output=foo.txt'],
    ['diff', '--output', 'foo.txt'],
    ['log', '--output=foo.txt'],
    ['log', '--exec=rm -rf'],
    ['diff', '--ext-diff'],
    ['grep', '-O', 'nano', 'pattern'],
    ['grep', '--open-files-in-pager', 'pattern'],
    ['branch', 'new-branch-name'],
    ['branch', '-d', 'old-branch'],
    ['branch', '-D', 'old-branch'],
    ['branch', '-m', 'old-name', 'new-name'],
    ['tag', 'v9.9.9'],
    ['tag', '-d', 'v1.0.0'],
    ['tag', '-a', 'v2.0.0', '-m', 'annotated'],
    ['remote', 'add', 'upstream', 'https://github.com/foo/bar.git'],
    ['remote', 'rm', 'origin'],
    ['config', 'user.name', 'Hacker'],
    ['config', '--unset', 'user.name'],
    ['-c', 'core.pager=rm', 'status'],
    ['status', '&&', 'rm', '-rf', '.'],
    ['grep', 'foo', ';', 'echo', 'bar'],
    ['log', '|', 'cat'],
    ['status', '>', 'out.txt'],
    ['ls-files', '&', 'rm'],
  ];

  for (const cmd of dangerousVariants) {
    const res = validateGitCommand(cmd);
    assert(!res.valid, `Dangerous variant rejected: git ${cmd.join(' ')} (Error: ${res.error})`);
  }

  // 5. Makefile targets check
  console.log('\n--- Makefile Integration ---');
  const makefilePath = path.join(rootDir, 'Makefile');
  const makefileContent = fs.readFileSync(makefilePath, 'utf-8');

  assert(
    makefileContent.includes('query-git:') &&
    makefileContent.includes('git-safe:') &&
    makefileContent.includes('.PHONY:') &&
    makefileContent.match(/\.PHONY:.*query-git/) !== null,
    'Makefile contains query-git and git-safe in .PHONY and target rules',
  );

  console.log('\n=====================================================');
  console.log('🎉 All query_git security and functionality tests passed!');
  console.log('=====================================================\n');
}

runTests();

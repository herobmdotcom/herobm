import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

/**
 * HeroBM Safe Read-Only Git Tool ('make query-git')
 *
 * Provides a permission-free, strictly read-only interface for AI agents
 * and developers to inspect repository files, search code, check git status,
 * diffs, logs, blames, and refs without risk of repository mutation.
 *
 * Usage for Agents:
 * 1. Write query string into `tmp/git_query.txt` (e.g. `grep -n "createMockDb" apps/`)
 * 2. Run fixed command: `make query-git`
 * 3. Read output from console or `tmp/git_query_out.txt`
 */

const PROJECT_ROOT = path.resolve(__dirname, '..');
const TMP_DIR = path.resolve(PROJECT_ROOT, 'tmp');

export interface ValidationResult {
  valid: boolean;
  error?: string;
  sanitizedArgs?: string[];
  subcommand?: string;
}

/**
 * Tokenize a command line string into separate arguments, respecting single and double quotes.
 */
export function tokenizeCommandLine(cmd: string): string[] {
  const tokens: string[] = [];
  let current = '';
  let inDoubleQuote = false;
  let inSingleQuote = false;
  let escaped = false;

  for (let i = 0; i < cmd.length; i++) {
    const char = cmd[i];

    if (escaped) {
      current += char;
      escaped = false;
      continue;
    }

    if (char === '\\' && !inSingleQuote) {
      escaped = true;
      continue;
    }

    if (char === '"' && !inSingleQuote) {
      inDoubleQuote = !inDoubleQuote;
      continue;
    }

    if (char === "'" && !inDoubleQuote) {
      inSingleQuote = !inSingleQuote;
      continue;
    }

    if (/\s/.test(char) && !inDoubleQuote && !inSingleQuote) {
      if (current.length > 0) {
        tokens.push(current);
        current = '';
      }
      continue;
    }

    current += char;
  }

  if (current.length > 0) {
    tokens.push(current);
  }

  return tokens;
}

/**
 * Check candidate files for query input if no command line arguments were provided.
 */
export function getQueryFromFile(): { cmd: string; file: string } | null {
  const candidates = [
    path.join(TMP_DIR, 'git_query.txt'),
    path.join(TMP_DIR, 'git_cmd.txt'),
    path.join(PROJECT_ROOT, '.git_query'),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      const content = fs.readFileSync(candidate, 'utf-8').trim();
      // Ignore comment lines
      const nonCommentLines = content
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter((l) => l.length > 0 && !l.startsWith('#'));

      if (nonCommentLines.length > 0) {
        return {
          cmd: nonCommentLines[0],
          file: path.relative(PROJECT_ROOT, candidate),
        };
      }
    }
  }

  return null;
}

/**
 * Parse input arguments from CLI, Make invocation, or query file.
 */
export function parseArgs(rawArgs: string[]): { args: string[]; source: 'cli' | 'file' | 'none' } {
  if (rawArgs.length > 0) {
    if (rawArgs.length === 1 && rawArgs[0].trim().includes(' ')) {
      return { args: tokenizeCommandLine(rawArgs[0].trim()), source: 'cli' };
    }
    return { args: rawArgs, source: 'cli' };
  }

  const fileInput = getQueryFromFile();
  if (fileInput) {
    return { args: tokenizeCommandLine(fileInput.cmd), source: 'file' };
  }

  return { args: [], source: 'none' };
}

const ALLOWED_SUBCOMMANDS = new Set([
  'status',
  'ls-files',
  'grep',
  'log',
  'diff',
  'show',
  'branch',
  'tag',
  'blame',
  'rev-parse',
  'describe',
  'shortlog',
  'check-ignore',
  'cat-file',
  'ls-tree',
  'remote',
  'config',
  'help',
  'version',
]);

const MUTATING_SUBCOMMANDS = new Set([
  'add',
  'commit',
  'push',
  'pull',
  'fetch',
  'checkout',
  'switch',
  'restore',
  'reset',
  'clean',
  'rm',
  'mv',
  'merge',
  'rebase',
  'cherry-pick',
  'revert',
  'stash',
  'submodule',
  'apply',
  'am',
  'bisect',
  'init',
  'clone',
  'update-index',
  'read-tree',
  'write-tree',
  'commit-tree',
  'mktree',
  'symbolic-ref',
  'update-ref',
  'prune',
  'gc',
  'notes',
  'worktree',
]);

/**
 * Validate that the requested git command is strictly read-only and safe.
 */
export function validateGitCommand(args: string[]): ValidationResult {
  if (args.length === 0) {
    return { valid: true, sanitizedArgs: [] };
  }

  // Strip leading 'git' if user accidentally passed 'git <subcommand>'
  let workingArgs = [...args];
  if (workingArgs[0] === 'git') {
    workingArgs.shift();
  }

  if (workingArgs.length === 0) {
    return { valid: true, sanitizedArgs: [] };
  }

  // Anti-Chaining Check: Reject shell operators that attempt to separate or chain commands
  const CHAINING_TOKENS = new Set([';', '&&', '||', '|', '&', '>', '>>', '<', '|&', ';;', ';&']);
  for (const arg of workingArgs) {
    if (CHAINING_TOKENS.has(arg)) {
      return {
        valid: false,
        error: `Command chaining and redirection operator '${arg}' is strictly forbidden. Exactly one read-only git command may be executed per invocation.`,
      };
    }
  }

  // Parse global options before subcommand (e.g. -C <path>, --no-pager, --literal-pathspecs)
  let idx = 0;
  while (idx < workingArgs.length && workingArgs[idx].startsWith('-')) {
    const opt = workingArgs[idx];
    if (
      opt === '--no-pager' ||
      opt === '--literal-pathspecs' ||
      opt === '--no-optional-locks' ||
      opt === '--no-replace-objects'
    ) {
      idx++;
      continue;
    }
    if (opt === '-C') {
      if (idx + 1 >= workingArgs.length) {
        return { valid: false, error: 'Missing path after -C option.' };
      }
      const targetPath = path.resolve(PROJECT_ROOT, workingArgs[idx + 1]);
      if (!targetPath.startsWith(PROJECT_ROOT)) {
        return { valid: false, error: `Directory traversal outside project root is forbidden: ${workingArgs[idx + 1]}` };
      }
      idx += 2;
      continue;
    }
    if (opt === '-h' || opt === '--help') {
      return { valid: true, sanitizedArgs: ['--help'], subcommand: 'help' };
    }
    if (opt === '-v' || opt === '--version') {
      return { valid: true, sanitizedArgs: ['--version'], subcommand: 'version' };
    }
    // Block any other global options like -c, --config-env, --exec-path
    return { valid: false, error: `Forbidden global git option: '${opt}'. Only safe read-only queries are permitted.` };
  }

  if (idx >= workingArgs.length) {
    return { valid: true, sanitizedArgs: [] };
  }

  const subcommand = workingArgs[idx];
  const subArgs = workingArgs.slice(idx + 1);

  if (MUTATING_SUBCOMMANDS.has(subcommand.toLowerCase())) {
    return {
      valid: false,
      error: `Forbidden mutating git subcommand: '${subcommand}'. The 'query-git' tool is strictly read-only.`,
    };
  }

  if (!ALLOWED_SUBCOMMANDS.has(subcommand.toLowerCase())) {
    return {
      valid: false,
      error: `Disallowed git subcommand: '${subcommand}'. Allowed subcommands: ${Array.from(ALLOWED_SUBCOMMANDS).join(', ')}.`,
    };
  }

  // Universal check for dangerous options
  for (let i = 0; i < subArgs.length; i++) {
    const arg = subArgs[i];
    if (arg.startsWith('--output=') || arg === '--output') {
      return { valid: false, error: "The '--output' option is forbidden as it attempts to write to disk." };
    }
    if (arg.startsWith('--exec=') || arg === '--exec') {
      return { valid: false, error: "The '--exec' option is strictly forbidden for security reasons." };
    }
    if (arg.startsWith('--ext-diff') || arg.startsWith('--textconv')) {
      return { valid: false, error: "External diff and textconv drivers are forbidden for security reasons." };
    }
    if (arg.startsWith('--upload-pack') || arg.startsWith('--receive-pack')) {
      return { valid: false, error: `Forbidden option: '${arg}'.` };
    }
    if (subcommand === 'grep' && (arg === '-O' || arg === '--open-files-in-pager' || arg.startsWith('--pager'))) {
      return { valid: false, error: "Interactive pagers in 'git grep' are forbidden." };
    }
  }

  // Subcommand-specific safety validations
  switch (subcommand.toLowerCase()) {
    case 'branch': {
      const forbiddenBranchFlags = new Set([
        '-d',
        '-D',
        '--delete',
        '-m',
        '-M',
        '--move',
        '-c',
        '-C',
        '--copy',
        '--edit-description',
        '--set-upstream-to',
        '-u',
        '--unset-upstream',
      ]);
      const listingFlags = new Set([
        '-a',
        '--all',
        '-r',
        '--remotes',
        '-v',
        '-vv',
        '--verbose',
        '--show-current',
        '--contains',
        '--no-contains',
        '--merged',
        '--no-merged',
        '--list',
        '-l',
        '--sort',
        '--column',
        '--no-column',
        '--format',
      ]);

      let isExplicitListing = subArgs.length === 0;
      for (let i = 0; i < subArgs.length; i++) {
        const arg = subArgs[i];
        if (forbiddenBranchFlags.has(arg) || forbiddenBranchFlags.has(arg.split('=')[0])) {
          return {
            valid: false,
            error: `Forbidden branch mutation flag: '${arg}'. 'git branch' may only be used to list branches.`,
          };
        }
        if (listingFlags.has(arg) || listingFlags.has(arg.split('=')[0])) {
          isExplicitListing = true;
        } else if (!arg.startsWith('-')) {
          if (!isExplicitListing && !subArgs.some((a) => a === '-l' || a === '--list' || a === '--contains' || a === '--merged')) {
            return {
              valid: false,
              error: `Creating branches is forbidden via query-git: '${arg}'. Use listing flags (e.g. -a, -r, --list).`,
            };
          }
        }
      }
      break;
    }

    case 'tag': {
      const forbiddenTagFlags = new Set(['-d', '--delete', '-a', '-s', '-u', '-f', '--force', '--annotate']);
      for (const arg of subArgs) {
        if (forbiddenTagFlags.has(arg) || forbiddenTagFlags.has(arg.split('=')[0])) {
          return {
            valid: false,
            error: `Forbidden tag mutation flag: '${arg}'. 'git tag' may only be used to list tags.`,
          };
        }
      }
      const hasListFlag = subArgs.some((a) => a === '-l' || a === '--list' || a === '--contains' || a === '--merged');
      const nonFlagArgs = subArgs.filter((a) => !a.startsWith('-'));
      if (nonFlagArgs.length > 0 && !hasListFlag) {
        return {
          valid: false,
          error: `Creating tags is forbidden via query-git: '${nonFlagArgs.join(' ')}'. Use 'git tag -l <pattern>' to filter tags.`,
        };
      }
      break;
    }

    case 'remote': {
      if (subArgs.length > 0) {
        const remoteSub = subArgs[0];
        const allowedRemoteSubs = new Set(['-v', '--verbose', 'show', 'get-url']);
        if (!allowedRemoteSubs.has(remoteSub)) {
          return {
            valid: false,
            error: `Forbidden 'git remote' action: '${remoteSub}'. Allowed actions: -v, show, get-url.`,
          };
        }
      }
      break;
    }

    case 'config': {
      const allowedConfigFlags = new Set([
        '--get',
        '--get-all',
        '--get-regexp',
        '-l',
        '--list',
        '--show-origin',
        '--show-scope',
        '--name-only',
      ]);
      const hasReadFlag = subArgs.some((a) => allowedConfigFlags.has(a) || allowedConfigFlags.has(a.split('=')[0]));
      if (!hasReadFlag) {
        return {
          valid: false,
          error: "Forbidden 'git config' operation. Only read operations (--get, --list, -l) are allowed.",
        };
      }
      const forbiddenConfigFlags = new Set(['--unset', '--unset-all', '--add', '--replace-all', '--edit', '-e']);
      for (const arg of subArgs) {
        if (forbiddenConfigFlags.has(arg) || forbiddenConfigFlags.has(arg.split('=')[0])) {
          return { valid: false, error: `Forbidden config mutation flag: '${arg}'.` };
        }
      }
      break;
    }
  }

  return { valid: true, sanitizedArgs: workingArgs, subcommand: subcommand.toLowerCase() };
}

export function printHelp(): void {
  console.log(`
=============================================================================
 HeroBM Safe Read-Only Git Tool ('make query-git')
=============================================================================

Agent Workflow (Zero Approval Prompts):
  1. Write your command to 'tmp/git_query.txt':
     echo grep -n "createMockDb" apps/ > tmp/git_query.txt
  2. Run the constant Make target:
     make query-git
  3. Results are printed to console and saved to 'tmp/git_query_out.txt'

Manual CLI / Interactive Usage:
  make query-git ARGS="<git-command-and-flags>"
  make git-safe ARGS="<git-command-and-flags>"

Allowed Read-Only Commands:
  • status         Inspect repository status and modified files
                   Example: make query-git ARGS="status -s"
  • ls-files       List tracked, modified, or untracked files with path patterns
                   Example: make query-git ARGS="ls-files 'apps/api/**/*.ts'"
  • grep           Search code and text across repository files with regex support
                   Example: make query-git ARGS="grep -n 'createMockDb' apps/"
  • log            View commit history, changes, and commit logs
                   Example: make query-git ARGS="log -n 5 --oneline"
  • diff           Inspect diffs against HEAD, staged index, or commit hashes
                   Example: make query-git ARGS="diff --stat"
                   Example: make query-git ARGS="diff HEAD~1 apps/ops-portal"
  • show           View commit details, metadata, and patch content
                   Example: make query-git ARGS="show HEAD --stat"
  • blame          Inspect line-by-line file blame and revision history
                   Example: make query-git ARGS="blame -L 1,30 Makefile"
  • branch         List local and remote branches (listing mode only)
                   Example: make query-git ARGS="branch -a"
  • tag            List repository tags
                   Example: make query-git ARGS="tag -l 'v*'"
  • rev-parse      Resolve git object references (e.g. HEAD commit hash)
                   Example: make query-git ARGS="rev-parse HEAD"
  • describe       Describe the current commit relative to recent tags
                   Example: make query-git ARGS="describe --tags --always"
  • cat-file       Inspect object contents and metadata (-p, -t, -s)
                   Example: make query-git ARGS="cat-file -p HEAD:package.json"
  • ls-tree        List contents of a tree object
                   Example: make query-git ARGS="ls-tree -r --name-only HEAD tools"
  • check-ignore   Debug gitignore patterns
                   Example: make query-git ARGS="check-ignore -v tmp/test.txt"
  • remote         View remotes (-v, show, get-url)
                   Example: make query-git ARGS="remote -v"
  • config         Read git configuration (--list, --get)
                   Example: make query-git ARGS="config --get user.name"

Security Policy:
  • All mutating commands (commit, push, checkout, reset, rm, clean, rebase, etc.)
    and destructive flags (--output, --exec, -d) are strictly forbidden and blocked.
=============================================================================
`);
}

export function run(): void {
  const rawArgs = process.argv.slice(2);
  const { args: parsed, source } = parseArgs(rawArgs);

  if (parsed.length === 0 || parsed[0] === '--help' || parsed[0] === '-h' || parsed[0] === 'help') {
    printHelp();
    process.exit(0);
  }

  const validation = validateGitCommand(parsed);
  if (!validation.valid) {
    console.error('\n=====================================================');
    console.error('❌ READ-ONLY GIT SECURITY VIOLATION');
    console.error('=====================================================');
    console.error(`Command rejected: git ${parsed.join(' ')}`);
    console.error(`Reason: ${validation.error}\n`);
    console.error("This tool ('make query-git') strictly executes read-only git queries.");
    console.error('Run `make query-git` without arguments for usage and examples.');
    console.error('=====================================================\n');
    process.exit(1);
  }

  const finalArgs = ['--no-pager', ...(validation.sanitizedArgs || parsed)];

  if (source === 'file') {
    console.log(`[query-git] Executing query: git ${finalArgs.slice(1).join(' ')}`);
  }

  const result = spawnSync('git', finalArgs, {
    cwd: PROJECT_ROOT,
    encoding: 'utf-8',
    maxBuffer: 20 * 1024 * 1024, // 20MB buffer for large search results
    env: {
      ...process.env,
      PAGER: 'cat',
      GIT_PAGER: 'cat',
    },
  });

  if (result.error) {
    console.error(`Failed to execute git: ${result.error.message}`);
    process.exit(1);
  }

  const stdout = result.stdout || '';
  const stderr = result.stderr || '';

  // Write full output to tmp/git_query_out.txt for convenient agent parsing
  try {
    if (!fs.existsSync(TMP_DIR)) {
      fs.mkdirSync(TMP_DIR, { recursive: true });
    }
    const outContent = stdout || (stderr ? `[STDERR]\n${stderr}` : '');
    fs.writeFileSync(path.join(TMP_DIR, 'git_query_out.txt'), outContent, 'utf-8');
  } catch {
    // Non-fatal if tmp write fails
  }

  // Handle git grep status 1 (0 matches found) gracefully
  if (validation.subcommand === 'grep' && result.status === 1 && !stderr.trim()) {
    console.log('(No matches found)');
    process.exit(0);
  }

  if (stdout) {
    process.stdout.write(stdout);
  }

  if (stderr) {
    process.stderr.write(stderr);
  }

  process.exit(result.status ?? 0);
}

if (process.argv[1]) {
  const base = path.basename(process.argv[1]);
  if (base === 'query_git.ts' || base === 'query_git.js' || base === 'query_git.mjs') {
    run();
  }
}

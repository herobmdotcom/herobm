import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

const projectRoot = path.resolve(__dirname, '..');
const docsUserDir = path.join(projectRoot, 'docs/user');
const checkpointFile = path.join(docsUserDir, '.sync_checkpoint.json');
const routesFile = path.join(projectRoot, 'apps/ops-portal/lib/routes.ts');

interface CheckpointData {
  last_synced_commit: string;
  last_synced_at: string;
  synced_by?: string;
}

function getGitHead(): string {
  try {
    return execSync('git rev-parse HEAD', { cwd: projectRoot, encoding: 'utf-8' }).trim();
  } catch {
    return 'UNKNOWN';
  }
}

function getGitCommitsSince(baseCommit: string): string[] {
  try {
    const out = execSync(`git log ${baseCommit}..HEAD --oneline`, {
      cwd: projectRoot,
      encoding: 'utf-8',
    }).trim();
    return out ? out.split('\n') : [];
  } catch {
    return [];
  }
}

function extractFrontmatterRoutes(filePath: string): string[] {
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    const content = raw.replace(/\r\n/g, '\n');
    const match = content.match(/^---\n([\s\S]*?)\n---/);
    if (!match) return [];
    const yaml = match[1];
    const lines = yaml.split('\n');
    const routes: string[] = [];
    let inRoutes = false;

    for (const line of lines) {
      if (/^routes:\s*$/.test(line.trim())) {
        inRoutes = true;
        continue;
      }
      if (inRoutes) {
        if (/^\s*-\s*/.test(line)) {
          const r = line.replace(/^\s*-\s*["']?/, '').replace(/["']?\s*$/, '').trim();
          if (r) routes.push(r);
        } else if (/^[a-zA-Z0-9_-]+:/.test(line.trim())) {
          inRoutes = false;
        }
      }
    }
    return routes;
  } catch {
    return [];
  }
}

function extractPortalRoutes(): string[] {
  if (!fs.existsSync(routesFile)) return [];
  const content = fs.readFileSync(routesFile, 'utf-8');
  const routeRegex = /['"`](\/[a-zA-Z0-9_\-/:?]+)['"`]/g;
  const routes = new Set<string>();
  let m;
  while ((m = routeRegex.exec(content)) !== null) {
    const r = m[1].split('?')[0];
    if (r.startsWith('/')) {
      routes.add(r);
    }
  }
  return Array.from(routes).sort();
}

function routeMatches(portalRoute: string, docRoute: string): boolean {
  if (portalRoute === docRoute) return true;
  // Handle wildcard e.g. /inventory/*
  if (docRoute.endsWith('/*')) {
    const prefix = docRoute.slice(0, -2);
    return portalRoute === prefix || portalRoute.startsWith(prefix + '/');
  }
  // Handle params e.g. /sales-orders/:id vs /sales-orders/:id or /sales-orders/${id}
  const pParts = portalRoute.split('/').filter(Boolean);
  const dParts = docRoute.split('/').filter(Boolean);
  if (pParts.length !== dParts.length) return false;
  for (let i = 0; i < pParts.length; i++) {
    if (dParts[i].startsWith(':') || dParts[i].startsWith('$') || dParts[i] === '*') continue;
    if (pParts[i].startsWith(':') || pParts[i].startsWith('$') || pParts[i] === '*') continue;
    if (pParts[i] !== dParts[i]) return false;
  }
  return true;
}

export function runAudit(options: { updateCheckpoint?: boolean } = {}) {
  console.log('=====================================================');
  console.log('   HeroBM Documentation Sync Audit');
  console.log('=====================================================\n');

  const currentHead = getGitHead();

  let checkpoint: CheckpointData;
  if (fs.existsSync(checkpointFile)) {
    checkpoint = JSON.parse(fs.readFileSync(checkpointFile, 'utf-8'));
    console.log(`📌 Baseline Checkpoint Commit : ${checkpoint.last_synced_commit}`);
    console.log(`📅 Last Synced Date           : ${checkpoint.last_synced_at}`);
  } else {
    checkpoint = {
      last_synced_commit: '66706a03',
      last_synced_at: '2026-08-20T09:01:31Z',
    };
    console.log(`⚠️ No .sync_checkpoint.json found. Defaulting baseline to: ${checkpoint.last_synced_commit}`);
  }

  console.log(`🏷️ Current HEAD Commit         : ${currentHead.slice(0, 8)}\n`);

  // 1. Commits since last checkpoint
  const pendingCommits = getGitCommitsSince(checkpoint.last_synced_commit);
  if (pendingCommits.length === 0) {
    console.log('✅ Documentation is in sync with latest Git commits.');
  } else {
    console.log(`⚠️ ${pendingCommits.length} commits since last documentation sync:`);
    pendingCommits.slice(0, 15).forEach((c) => console.log(`   • ${c}`));
    if (pendingCommits.length > 15) {
      console.log(`   ... and ${pendingCommits.length - 15} more commits.`);
    }
  }

  console.log('\n-----------------------------------------------------');
  console.log('   Route Coverage Analysis');
  console.log('-----------------------------------------------------');

  // 2. Scan all docs
  const docFiles = fs.readdirSync(docsUserDir).filter((f) => f.endsWith('.md') && f !== 'CHANGELOG.md');
  const allDocRoutes: Array<{ file: string; routes: string[] }> = [];
  const coveredDocRoutes = new Set<string>();

  for (const file of docFiles) {
    const fullPath = path.join(docsUserDir, file);
    const routes = extractFrontmatterRoutes(fullPath);
    allDocRoutes.push({ file, routes });
    routes.forEach((r) => coveredDocRoutes.add(r));
  }

  console.log(`📖 Loaded ${docFiles.length} documentation topics in docs/user/`);

  // 3. Scan portal routes
  const portalRoutes = extractPortalRoutes();
  const unmappedPortalRoutes: string[] = [];

  for (const pr of portalRoutes) {
    const isCovered = Array.from(coveredDocRoutes).some((dr) => routeMatches(pr, dr));
    if (!isCovered) {
      unmappedPortalRoutes.push(pr);
    }
  }

  if (unmappedPortalRoutes.length === 0) {
    console.log(`✅ All ${portalRoutes.length} portal routes mapped to user documentation topics.`);
  } else {
    console.log(`⚠️ ${unmappedPortalRoutes.length} portal routes have no matching user doc topic:`);
    unmappedPortalRoutes.forEach((r) => console.log(`   ❌ ${r}`));
  }

  // 4. Update checkpoint if requested
  if (options.updateCheckpoint) {
    const newCheckpoint: CheckpointData = {
      last_synced_commit: currentHead.slice(0, 8),
      last_synced_at: new Date().toISOString(),
      synced_by: process.env.USERNAME || process.env.USER || 'agent',
    };
    fs.writeFileSync(checkpointFile, JSON.stringify(newCheckpoint, null, 2) + '\n', 'utf-8');
    console.log(`\n🎉 Updated checkpoint to HEAD (${newCheckpoint.last_synced_commit}) in ${checkpointFile}`);
  }

  console.log('\n=====================================================');
}

if (process.argv[1] && (process.argv[1].endsWith('audit_docs_sync.ts') || process.argv[1].endsWith('audit_docs_sync.js'))) {
  const isUpdate = process.argv.includes('--update-checkpoint');
  runAudit({ updateCheckpoint: isUpdate });
}

import createNextIntlPlugin from 'next-intl/plugin';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageJson = JSON.parse(readFileSync(join(__dirname, 'package.json'), 'utf8'));

let gitVersion = process.env.APP_VERSION || '';
if (!gitVersion) {
  try {
    const fromGit = execSync('git log -1 --format="%cd.%h" --date=format:%Y%m%d', { stdio: 'pipe' }).toString().trim();
    if (fromGit) {
      gitVersion = `v${packageJson.version}-${fromGit}`;
    }
  } catch (e) {
    // Ignore error if git is not available or not in a git repo
  }
}

const APP_VERSION = gitVersion || `v${packageJson.version}`;
const BUILD_TIME = process.env.BUILD_TIME || new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });

const withNextIntl = createNextIntlPlugin('./i18n/request.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  transpilePackages: ['@herobm/shared'],
  async rewrites() {
    const apiPort = process.env.API_PORT || '3001';
    const apiUrl = process.env.API_URL || `http://localhost:${apiPort}`;
    return [
      {
        source: '/api/:path*',
        destination: `${apiUrl}/api/:path*`,
      },
    ];
  },

  env: {
    APP_VERSION,
    BUILD_TIME,
  },
};

export default withNextIntl(nextConfig);

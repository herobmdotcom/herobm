import createNextIntlPlugin from 'next-intl/plugin';
import type { NextConfig } from 'next';

const withNextIntl = createNextIntlPlugin('./i18n/request.ts');

const nextConfig: NextConfig = {
  output: 'standalone',
  transpilePackages: ['@herobm/portal-ui', '@herobm/shared'],
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
  eslint: {
    ignoreDuringBuilds: true,
  },
  env: {
    BUILD_TIME: new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }),
  },
};

export default withNextIntl(nextConfig);

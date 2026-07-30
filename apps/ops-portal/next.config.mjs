import createNextIntlPlugin from 'next-intl/plugin';

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
    BUILD_TIME: new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }),
  },
};

export default withNextIntl(nextConfig);

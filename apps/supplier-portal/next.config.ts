import path from 'path';

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  transpilePackages: ['@modbm/portal-ui'],
  turbopack: {
    root: path.resolve(import.meta.dirname, '../../'),
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${process.env.API_URL ?? 'http://localhost:3001'}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;

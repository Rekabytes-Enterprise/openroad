import type { NextConfig } from 'next';
import path from 'node:path';

const root = path.resolve(process.cwd(), '../..');
const config: NextConfig = {
  output: 'standalone',
  outputFileTracingRoot: root,
  turbopack: { root },
  images: { unoptimized: true },
  devIndicators: false,
  async headers() {
    return [{ source: '/:path*', headers: [
      { key: 'Permissions-Policy', value: 'geolocation=(self), camera=(), microphone=()' },
      { key: 'X-Content-Type-Options', value: 'nosniff' },
    ] }, { source: '/sw.js', headers: [{ key: 'Cache-Control', value: 'no-cache' }] }];
  },
};
export default config;

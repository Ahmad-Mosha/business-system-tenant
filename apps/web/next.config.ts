import type { NextConfig } from 'next';

const apiBaseUrl = process.env.API_BASE_URL ?? 'http://localhost:4000';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // The browser only ever talks to this origin. Proxying the API through Next keeps the
  // session cookie first-party and removes CORS from the picture entirely.
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${apiBaseUrl}/:path*` }];
  },
};

export default nextConfig;

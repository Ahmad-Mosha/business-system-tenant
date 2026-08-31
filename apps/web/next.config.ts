import type { NextConfig } from 'next';

const config: NextConfig = {
  // The API is a separate service. One place defines where it lives.
  env: { API_URL: process.env.API_URL ?? 'http://localhost:3001' },
};

export default config;

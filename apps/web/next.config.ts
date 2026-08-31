import type { NextConfig } from 'next';

const config: NextConfig = {
  // The floating dev badge sits on top of the sidebar footer.
  devIndicators: false,
  // A self-contained server build for the production Docker image — only the
  // node_modules actually used, not the whole workspace install.
  output: 'standalone',
};

export default config;

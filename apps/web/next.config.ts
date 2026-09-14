import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const config: NextConfig = {
  // The floating dev badge sits on top of the sidebar footer.
  devIndicators: false,
  // A self-contained server build for the production Docker image — only the
  // node_modules actually used, not the whole workspace install.
  output: 'standalone',
};

// Points next-intl at the request config that reads the language cookie.
export default createNextIntlPlugin('./src/i18n/request.ts')(config);

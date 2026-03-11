import type { NextConfig } from 'next';
import { withSentryConfig } from '@sentry/nextjs';

const nextConfig: NextConfig = {
  compress: true,
  transpilePackages: ['@agentforge/shared'],
  experimental: {
    serverComponentsExternalPackages: [],
  },
};

export default withSentryConfig(nextConfig, {
  org: process.env['SENTRY_ORG'],
  project: process.env['SENTRY_PROJECT'],
  silent: !process.env['CI'],
  widenClientFileUpload: true,
  disableLogger: true,
});

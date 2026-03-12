import type { NextConfig } from 'next';

const config: NextConfig = {
  // Required for Docker: runner stage copies .next/standalone
  output: 'standalone',
  compress: true,
  transpilePackages: ['@agentforge/shared'],
};

export default config;

// NOTE (task 1.4): Re-add withSentryConfig once the full app is scaffolded:
//
//   import { withSentryConfig } from '@sentry/nextjs';
//   export default process.env.SENTRY_AUTH_TOKEN
//     ? withSentryConfig(config, { org, project, ... })
//     : config;

// Sentry client-side initialisation (browser).
// This file is auto-loaded by @sentry/nextjs when placed at the root.
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env['NEXT_PUBLIC_SENTRY_DSN'] ?? process.env['SENTRY_DSN'],
  environment: process.env['NODE_ENV'] ?? 'development',
  enabled: Boolean(process.env['NEXT_PUBLIC_SENTRY_DSN'] ?? process.env['SENTRY_DSN']),
  tracesSampleRate: process.env['NODE_ENV'] === 'production' ? 0.1 : 1.0,
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
  integrations: [Sentry.replayIntegration()],
});

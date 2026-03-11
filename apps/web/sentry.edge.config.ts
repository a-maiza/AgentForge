// Sentry Edge Runtime initialisation (middleware, edge routes).
// Auto-loaded by @sentry/nextjs.
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env['SENTRY_DSN'],
  environment: process.env['NODE_ENV'] ?? 'development',
  enabled: Boolean(process.env['SENTRY_DSN']),
  tracesSampleRate: process.env['NODE_ENV'] === 'production' ? 0.1 : 1.0,
});

// Sentry initialisation for NestJS API.
// Wire this into main.ts in task 1.3:
//   import './sentry';  // must be first import
// NOTE (task 1.3): add @sentry/profiling-node dep and nodeProfilingIntegration when fully wiring Sentry.
import * as Sentry from '@sentry/nestjs';

Sentry.init({
  dsn: process.env['SENTRY_DSN'],
  environment: process.env['NODE_ENV'] ?? 'development',
  enabled: Boolean(process.env['SENTRY_DSN']),
  tracesSampleRate: process.env['NODE_ENV'] === 'production' ? 0.1 : 1.0,
});

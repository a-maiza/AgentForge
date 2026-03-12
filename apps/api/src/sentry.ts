// Sentry initialisation for NestJS API.
// Wire this into main.ts in task 1.3:
//   import './sentry';  // must be first import
// NOTE (task 1.3): add @sentry/profiling-node dep and nodeProfilingIntegration when fully wiring Sentry.
import * as Sentry from '@sentry/nestjs';

const dsn = process.env['SENTRY_DSN'];
if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env['NODE_ENV'] ?? 'development',
    tracesSampleRate: process.env['NODE_ENV'] === 'production' ? 0.1 : 1.0,
  });
}

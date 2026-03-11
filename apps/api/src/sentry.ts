// Sentry initialisation for NestJS API.
// Wire this into main.ts in task 1.3:
//   import './sentry';  // must be first import
import * as Sentry from '@sentry/nestjs';
import { nodeProfilingIntegration } from '@sentry/profiling-node';

Sentry.init({
  dsn: process.env['SENTRY_DSN'],
  environment: process.env['NODE_ENV'] ?? 'development',
  enabled: Boolean(process.env['SENTRY_DSN']),
  integrations: [nodeProfilingIntegration()],
  tracesSampleRate: process.env['NODE_ENV'] === 'production' ? 0.1 : 1.0,
  profilesSampleRate: process.env['NODE_ENV'] === 'production' ? 0.1 : 1.0,
});

/**
 * Set required environment variables before NestJS ConfigModule initialises.
 * This file must be required before the app module is imported.
 */
process.env['NODE_ENV'] = 'test';
process.env['DATABASE_URL'] = 'postgresql://test:test@localhost:5432/test';
process.env['REDIS_URL'] = 'redis://localhost:6379';
process.env['JWT_SECRET'] = 'test-jwt-secret-at-least-32-characters-long';
process.env['CLERK_SECRET_KEY'] = 'sk_test_clerktestkey123456789';
process.env['CLERK_WEBHOOK_SECRET'] = 'whsec_test1234567890abcdef';
process.env['ENCRYPTION_KEY'] = 'a'.repeat(64);
process.env['PORT'] = '3001';

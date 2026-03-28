import './sentry.js';
import { NestFactory, Reflector } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { ValidationPipe, ClassSerializerInterceptor } from '@nestjs/common';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module.js';
import { HttpExceptionFilter } from './common/filters/http-exception.filter.js';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ logger: false }),
  );

  app.useLogger(app.get(Logger));
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));
  app.useGlobalFilters(new HttpExceptionFilter());

  app.enableCors({
    origin: process.env['FRONTEND_URL'] ?? 'http://localhost:3000',
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Authorization', 'Content-Type'],
    credentials: true,
  });

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  await app.register(require('@fastify/multipart'), { limits: { fileSize: 50 * 1024 * 1024 } });

  // Let NestJS register its default parsers first, then replace the JSON parser
  // to capture raw body for webhook signature verification (svix).
  await app.init();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fastify = app.getHttpAdapter().getInstance() as any;
  fastify.removeContentTypeParser('application/json');
  fastify.addContentTypeParser(
    'application/json',
    { parseAs: 'buffer' },
    (_req: unknown, body: Buffer, done: (err: Error | null, body?: unknown) => void) => {
      try {
        const parsed = JSON.parse(body.toString('utf8')) as unknown;
        (_req as Record<string, unknown>)['rawBody'] = body;
        done(null, parsed);
      } catch (err) {
        done(err as Error);
      }
    },
  );

  await app.listen(Number(process.env['PORT'] ?? 3001), '0.0.0.0');
}

void bootstrap();

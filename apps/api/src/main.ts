// Entry point — bootstrapped fully in task 1.3
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter());
  await app.listen(Number(process.env['PORT'] ?? 3001), '0.0.0.0');
}

void bootstrap();

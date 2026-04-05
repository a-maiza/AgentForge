import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { LoggerModule } from 'nestjs-pino';
import * as Joi from 'joi';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { AuthGuard } from './auth/auth.guard';
import { UsersModule } from './users/users.module';
import { OrganizationsModule } from './organizations/organizations.module';
import { WorkspacesModule } from './workspaces/workspaces.module';
import { PromptsModule } from './prompts/prompts.module';
import { StorageModule } from './storage/storage.module';
import { DatasetsModule } from './datasets/datasets.module';
import { AiProvidersModule } from './ai-providers/ai-providers.module';
import { PromptAiConfigsModule } from './prompt-ai-configs/prompt-ai-configs.module';
import { EvaluationsModule } from './evaluations/evaluations.module';
import { MetricsModule } from './metrics/metrics.module';
import { DeploymentsModule } from './deployments/deployments.module';
import { ApiKeysModule } from './api-keys/api-keys.module';
import { FailoverConfigsModule } from './failover-configs/failover-configs.module';
import { MonitoringModule } from './monitoring/monitoring.module';
import { AgentsModule } from './agents/agents.module';
import { AuditModule } from './audit/audit.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: Joi.object({
        DATABASE_URL: Joi.string().required(),
        REDIS_URL: Joi.string().required(),
        JWT_SECRET: Joi.string().min(32).required(),
        CLERK_SECRET_KEY: Joi.string().required(),
        CLERK_WEBHOOK_SECRET: Joi.string().required(),
        ENCRYPTION_KEY: Joi.string().length(64).required(),
        PORT: Joi.number().default(3001),
        NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
      }),
      validationOptions: { abortEarly: true },
    }),
    LoggerModule.forRoot({
      pinoHttp: {
        autoLogging: true,
        redact: ['req.headers.authorization'],
        ...(process.env['NODE_ENV'] !== 'production' && {
          transport: { target: 'pino-pretty', options: { colorize: true, singleLine: true } },
        }),
      },
    }),
    PrismaModule,
    AuthModule,
    UsersModule,
    OrganizationsModule,
    WorkspacesModule,
    PromptsModule,
    StorageModule,
    DatasetsModule,
    AiProvidersModule,
    PromptAiConfigsModule,
    EvaluationsModule,
    MetricsModule,
    DeploymentsModule,
    ApiKeysModule,
    FailoverConfigsModule,
    MonitoringModule,
    AgentsModule,
    AuditModule,
  ],
  providers: [
    // Apply AuthGuard globally; use @Public() to opt-out on specific routes
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
})
export class AppModule {}

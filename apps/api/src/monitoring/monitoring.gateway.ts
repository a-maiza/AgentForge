import { Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Redis } from 'ioredis';
import { JoinWorkspaceDto } from './dto/monitoring-query.dto';
import { MonitoringService } from './monitoring.service';

function redisConnection(): { host: string; port: number } {
  const url = process.env['REDIS_URL'] ?? 'redis://localhost:6379';
  const parsed = new URL(url);
  return { host: parsed.hostname, port: Number(parsed.port) || 6379 };
}

@WebSocketGateway({ namespace: '/monitoring', cors: { origin: '*' } })
export class MonitoringGateway implements OnModuleInit, OnModuleDestroy {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  @WebSocketServer() server!: any;

  private readonly logger = new Logger(MonitoringGateway.name);
  private readonly subscriber: Redis;

  constructor(private readonly monitoringService: MonitoringService) {
    const { host, port } = redisConnection();
    this.subscriber = new Redis({ host, port, lazyConnect: true });
    this.subscriber.on('error', (err: Error) => {
      this.logger.warn(`Redis subscriber error: ${err.message}`);
    });
  }

  onModuleInit() {
    void this.subscriber.psubscribe('metrics.*', (err) => {
      if (err) this.logger.error(`psubscribe error: ${err.message}`);
      else this.logger.log('Subscribed to metrics.* pattern');
    });

    this.subscriber.on('pmessage', (_pattern: string, channel: string, message: string) => {
      // channel = "metrics.workspace.<workspaceId>"
      const workspaceId = channel.split('.').slice(2).join('.');
      if (!workspaceId) return;
      try {
        const payload = JSON.parse(message) as unknown;
        this.server.to(`workspace:${workspaceId}`).emit('metrics_update', payload);
      } catch {
        this.logger.warn(`Failed to parse metrics message on channel ${channel}`);
      }
    });
  }

  onModuleDestroy() {
    void this.subscriber.quit();
  }

  // ─── Client joins a workspace room ─────────────────────────────────────────

  @SubscribeMessage('join_workspace')
  async handleJoinWorkspace(
    @MessageBody() dto: JoinWorkspaceDto,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    @ConnectedSocket() client: any,
  ): Promise<{ event: string; data: string }> {
    const room = `workspace:${dto.workspaceId}`;
    await client.join(room);
    this.logger.log(`Client ${client.id} joined room ${room}`);

    // Push an initial snapshot immediately after joining
    try {
      const summary = await this.monitoringService.getSummary(dto.workspaceId, {});
      client.emit('metrics_update', {
        workspaceId: dto.workspaceId,
        metrics: summary,
        timestamp: new Date().toISOString(),
      });
    } catch {
      // Non-fatal — client will receive updates when next metric arrives
    }

    return { event: 'joined', data: room };
  }

  @SubscribeMessage('leave_workspace')
  async handleLeaveWorkspace(
    @MessageBody() dto: JoinWorkspaceDto,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    @ConnectedSocket() client: any,
  ): Promise<void> {
    await client.leave(`workspace:${dto.workspaceId}`);
  }
}

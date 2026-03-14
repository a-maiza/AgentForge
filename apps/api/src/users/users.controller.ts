import {
  Controller,
  Get,
  Post,
  Req,
  Headers,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { Webhook } from 'svix';
import type { UsersService } from './users.service';
import { Public } from '../auth/public.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import type { FastifyRequest } from 'fastify';
import type { User } from '@prisma/client';

interface ClerkWebhookEvent {
  type: string;
  data: {
    id: string;
    email_addresses: Array<{ email_address: string; id: string }>;
    first_name: string | null;
    last_name: string | null;
    image_url: string | null;
    primary_email_address_id: string | null;
  };
}

@Controller()
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly config: ConfigService,
  ) {}

  @Get('auth/me')
  me(@CurrentUser() user: User): User {
    return user;
  }

  @Post('webhooks/clerk')
  @Public()
  @HttpCode(HttpStatus.OK)
  async clerkWebhook(
    @Req() req: FastifyRequest & { rawBody?: Buffer },
    @Headers('svix-id') svixId: string,
    @Headers('svix-timestamp') svixTimestamp: string,
    @Headers('svix-signature') svixSignature: string,
  ): Promise<{ received: boolean }> {
    const secret = this.config.get<string>('CLERK_WEBHOOK_SECRET');
    if (!secret) throw new UnauthorizedException('Webhook secret not configured');

    const rawBody = req.rawBody;
    if (!rawBody) throw new BadRequestException('Missing raw body');

    const wh = new Webhook(secret);
    let event: ClerkWebhookEvent;

    try {
      event = wh.verify(rawBody, {
        'svix-id': svixId,
        'svix-timestamp': svixTimestamp,
        'svix-signature': svixSignature,
      }) as ClerkWebhookEvent;
    } catch {
      throw new UnauthorizedException('Invalid webhook signature');
    }

    switch (event.type) {
      case 'user.created':
      case 'user.updated':
        await this.usersService.upsertFromClerk(event.data);
        break;
      case 'user.deleted':
        await this.usersService.deleteByClerkId(event.data.id).catch(() => null);
        break;
    }

    return { received: true };
  }
}

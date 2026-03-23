import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { verifyToken, createClerkClient } from '@clerk/backend';
import { IS_PUBLIC_KEY } from './public.decorator';
import { UsersService } from '../users/users.service';
import type { FastifyRequest } from 'fastify';
import type { User } from '@prisma/client';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly config: ConfigService,
    private readonly usersService: UsersService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<FastifyRequest & { user?: User }>();
    const authHeader = request.headers['authorization'];

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing or invalid authorization header');
    }

    const token = authHeader.slice(7);

    try {
      const secretKey = this.config.getOrThrow<string>('CLERK_SECRET_KEY');
      const payload = await verifyToken(token, { secretKey });

      let user = await this.usersService.findByClerkId(payload.sub);

      // Just-in-time provisioning: Clerk webhooks may not reach localhost in dev,
      // so fetch the user from Clerk and create a local record on first login.
      if (!user) {
        // JIT provisioning: Clerk webhooks may not reach localhost in dev
        const clerk = createClerkClient({ secretKey });
        const clerkUser = await clerk.users.getUser(payload.sub);
        user = await this.usersService.upsertFromClerk({
          id: clerkUser.id,
          email_addresses: clerkUser.emailAddresses.map((e) => ({
            email_address: e.emailAddress,
            id: e.id,
          })),
          first_name: clerkUser.firstName,
          last_name: clerkUser.lastName,
          image_url: clerkUser.imageUrl,
          primary_email_address_id: clerkUser.primaryEmailAddressId,
        });
      }

      request.user = user;
      return true;
    } catch (err) {
      if (err instanceof UnauthorizedException) throw err;
      throw new UnauthorizedException('Invalid token');
    }
  }
}

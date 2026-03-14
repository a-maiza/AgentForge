import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { verifyToken } from '@clerk/backend';
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
      const payload = await verifyToken(token, {
        secretKey: this.config.getOrThrow<string>('CLERK_SECRET_KEY'),
      });

      const user = await this.usersService.findByClerkId(payload.sub);
      if (!user) {
        throw new UnauthorizedException('User not found in database');
      }

      request.user = user;
      return true;
    } catch (err) {
      if (err instanceof UnauthorizedException) throw err;
      throw new UnauthorizedException('Invalid token');
    }
  }
}

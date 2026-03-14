import { Injectable } from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service';
import type { User } from '@prisma/client';

interface ClerkUserData {
  id: string;
  email_addresses: Array<{ email_address: string; id: string }>;
  first_name: string | null;
  last_name: string | null;
  image_url: string | null;
  primary_email_address_id: string | null;
}

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  findByClerkId(clerkId: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { clerkId } });
  }

  findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  upsertFromClerk(data: ClerkUserData): Promise<User> {
    const primaryEmail = data.email_addresses.find(
      (e) => e.id === data.primary_email_address_id,
    );
    const email =
      primaryEmail?.email_address ??
      data.email_addresses[0]?.email_address ??
      '';
    const name =
      [data.first_name, data.last_name].filter(Boolean).join(' ') || email;

    return this.prisma.user.upsert({
      where: { clerkId: data.id },
      create: { clerkId: data.id, email, name, avatarUrl: data.image_url },
      update: { email, name, avatarUrl: data.image_url },
    });
  }

  deleteByClerkId(clerkId: string): Promise<User> {
    return this.prisma.user.delete({ where: { clerkId } });
  }
}

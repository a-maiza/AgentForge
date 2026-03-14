import { PipeTransform, BadRequestException } from '@nestjs/common';
import type { ZodSchema } from 'zod';

export class ZodValidationPipe implements PipeTransform {
  constructor(private readonly schema: ZodSchema) {}

  transform(value: unknown): unknown {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      const messages = result.error.errors.map(
        (e) => `${e.path.join('.') || 'body'}: ${e.message}`,
      );
      throw new BadRequestException(messages.join('; '));
    }
    return result.data;
  }
}

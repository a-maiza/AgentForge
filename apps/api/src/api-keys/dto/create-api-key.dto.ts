import {
  IsEnum,
  IsISO8601,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export type ApiKeyScope = 'organization' | 'workspace' | 'readonly';

export class CreateApiKeyDto {
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name!: string;

  @IsEnum(['organization', 'workspace', 'readonly'])
  scope!: ApiKeyScope;

  @IsInt()
  @Min(1)
  @Max(10000)
  @IsOptional()
  rateLimitPerMin?: number;

  @IsInt()
  @Min(1)
  @Max(10000000)
  @IsOptional()
  rateLimitPerDay?: number;

  @IsISO8601()
  @IsOptional()
  expiresAt?: string;
}

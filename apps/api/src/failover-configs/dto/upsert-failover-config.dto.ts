import { IsBoolean, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';

export class UpsertFailoverConfigDto {
  @IsUUID()
  primaryProviderId!: string;

  @IsUUID()
  secondaryProviderId!: string;

  @IsBoolean()
  @IsOptional()
  isEnabled?: boolean;

  @IsInt()
  @Min(1000)
  @Max(120000)
  @IsOptional()
  timeoutMs?: number;

  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  errorThreshold?: number;

  @IsInt()
  @Min(100)
  @Max(60000)
  @IsOptional()
  maxLatencyMs?: number;

  @IsBoolean()
  @IsOptional()
  autoRecovery?: boolean;

  @IsInt()
  @Min(10000)
  @IsOptional()
  recoveryCheckIntervalMs?: number;
}

import { IsEnum, IsOptional, IsString, IsDateString, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export type TimeWindow = '1m' | '5m' | '1h' | '24h' | '7d';
export type TimeBucket = '1m' | '5m' | '15m' | '1h';
export type DeploymentEnv = 'dev' | 'staging' | 'prod';

export class SummaryQueryDto {
  @IsOptional()
  @IsEnum(['1m', '5m', '1h', '24h', '7d'])
  window?: TimeWindow = '1h';

  @IsOptional()
  @IsEnum(['dev', 'staging', 'prod'])
  environment?: DeploymentEnv;
}

export class TimeseriesQueryDto {
  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @IsEnum(['1m', '5m', '15m', '1h'])
  bucket?: TimeBucket = '5m';

  @IsOptional()
  @IsEnum(['dev', 'staging', 'prod'])
  environment?: DeploymentEnv;
}

export class ApiCallsQueryDto {
  @IsOptional()
  @IsEnum(['dev', 'staging', 'prod'])
  environment?: DeploymentEnv;
}

export class SuggestionsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10)
  lastN?: number = 5;
}

export class JoinWorkspaceDto {
  @IsString()
  workspaceId!: string;
}

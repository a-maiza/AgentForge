import { Controller, Get, Param, Query, Req } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import type { User } from '@prisma/client';
import { MonitoringService } from './monitoring.service';
import type {
  SummaryQueryDto,
  TimeseriesQueryDto,
  ApiCallsQueryDto,
  SuggestionsQueryDto,
} from './dto/monitoring-query.dto';

@Controller('api/monitoring')
export class MonitoringController {
  constructor(private readonly monitoring: MonitoringService) {}

  // GET /api/monitoring/summary?window=1h&environment=prod
  @Get('summary')
  getSummary(
    @Req() req: FastifyRequest & { user: User & { workspaceId?: string } },
    @Query() dto: SummaryQueryDto,
  ) {
    const workspaceId = (req as unknown as { workspaceId: string }).workspaceId ?? req.user.id;
    return this.monitoring.getSummary(workspaceId, dto);
  }

  // GET /api/monitoring/timeseries?from=...&to=...&bucket=5m
  @Get('timeseries')
  getTimeseries(
    @Req() req: FastifyRequest & { user: User },
    @Query() dto: TimeseriesQueryDto,
  ) {
    const workspaceId = (req as unknown as { workspaceId: string }).workspaceId ?? req.user.id;
    return this.monitoring.getTimeseries(workspaceId, dto);
  }

  // GET /api/monitoring/api-calls?environment=prod
  @Get('api-calls')
  getApiCalls(
    @Req() req: FastifyRequest & { user: User },
    @Query() dto: ApiCallsQueryDto,
  ) {
    const workspaceId = (req as unknown as { workspaceId: string }).workspaceId ?? req.user.id;
    return this.monitoring.getApiCallsBreakdown(workspaceId, dto);
  }

  // GET /api/monitoring/workspaces/:workspaceId/summary
  @Get('workspaces/:workspaceId/summary')
  getWorkspaceSummary(
    @Param('workspaceId') workspaceId: string,
    @Query() dto: SummaryQueryDto,
  ) {
    return this.monitoring.getSummary(workspaceId, dto);
  }

  // GET /api/monitoring/workspaces/:workspaceId/timeseries
  @Get('workspaces/:workspaceId/timeseries')
  getWorkspaceTimeseries(
    @Param('workspaceId') workspaceId: string,
    @Query() dto: TimeseriesQueryDto,
  ) {
    return this.monitoring.getTimeseries(workspaceId, dto);
  }

  // GET /api/monitoring/workspaces/:workspaceId/api-calls
  @Get('workspaces/:workspaceId/api-calls')
  getWorkspaceApiCalls(
    @Param('workspaceId') workspaceId: string,
    @Query() dto: ApiCallsQueryDto,
  ) {
    return this.monitoring.getApiCallsBreakdown(workspaceId, dto);
  }

  // GET /api/monitoring/prompts/:promptId/analytics
  @Get('prompts/:promptId/analytics')
  getPromptAnalytics(@Param('promptId') promptId: string) {
    return this.monitoring.getPromptAnalytics(promptId);
  }

  // GET /api/monitoring/prompts/:promptId/suggestions?lastN=5
  @Get('prompts/:promptId/suggestions')
  getSuggestions(
    @Param('promptId') promptId: string,
    @Query() dto: SuggestionsQueryDto,
  ) {
    return this.monitoring.getOptimizationSuggestions(promptId, dto.lastN ?? 5);
  }
}

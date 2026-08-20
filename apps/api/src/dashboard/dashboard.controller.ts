import { SystemResource } from '@herobm/shared';
import { ApiTags, ApiOperation, ApiOkResponse } from '@nestjs/swagger';
import { Controller, Get, Query } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { CasbinResource, CasbinAction } from '../auth/casbin.guard';
import {
  DashboardSummaryDto,
  UniversalSearchResponseDto,
  TimelineEventDto,
} from './dto';

@ApiTags('System')
@Controller('dashboard')
@CasbinResource(SystemResource.DASHBOARD)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('summary')
  @CasbinAction('read')
  @ApiOperation({
    summary: 'Get Summary',
    description: 'Retrieves key metrics and statistics for the dashboard.',
  })
  @ApiOkResponse({ type: DashboardSummaryDto })
  getSummary() {
    return this.dashboardService.getSummary();
  }

  @Get('search')
  @CasbinAction('read')
  @ApiOperation({
    summary: 'Universal Search',
    description: 'Performs a global search across multiple entity types.',
  })
  @ApiOkResponse({ type: UniversalSearchResponseDto })
  search(@Query('q') q: string) {
    return this.dashboardService.universalSearch(q);
  }

  @Get('timeline')
  @CasbinAction('read')
  @ApiOperation({
    summary: 'Get Timeline',
    description: 'Retrieves a chronological list of recent system events.',
  })
  @ApiOkResponse({ type: [TimelineEventDto] })
  getTimeline(
    @Query('types') typesQuery: string,
    @Query('limit') limitStr: string,
  ) {
    const types =
      typeof typesQuery === 'string' && typesQuery.length > 0
        ? typesQuery.split(',')
        : [];
    const limit = limitStr ? parseInt(limitStr, 10) : 50;
    return this.dashboardService.getTimeline(types, limit);
  }
}

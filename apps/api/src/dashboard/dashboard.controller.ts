import { SystemResource } from '@modbm/shared';
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiBody,
} from '@nestjs/swagger';
import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { DashboardService } from './dashboard.service';
import {
  CasbinGuard,
  CasbinResource,
  CasbinAction,
} from '../auth/casbin.guard';

@ApiTags('Dashboard')
@Controller('dashboard')
@UseGuards(AuthGuard(['jwt', 'api-key']), CasbinGuard)
@CasbinResource(SystemResource.DASHBOARD)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('summary')
  @CasbinAction('read')
  @ApiOperation({
    summary: 'Get Summary',
    description: 'Retrieves key metrics and statistics for the dashboard.',
  })
  @ApiOkResponse({ type: Object }) // BYPASS-TYPING-TEST
  getSummary() {
    return this.dashboardService.getSummary();
  }

  @Get('search')
  @CasbinAction('read')
  @ApiOperation({
    summary: 'Universal Search',
    description: 'Performs a global search across multiple entity types.',
  })
  @ApiOkResponse({ schema: { type: 'array', items: { type: 'object' } } }) // BYPASS-TYPING-TEST
  search(@Query('q') q: string) {
    return this.dashboardService.universalSearch(q);
  }

  @Get('timeline')
  @CasbinAction('read')
  @ApiOperation({
    summary: 'Get Timeline',
    description: 'Retrieves a chronological list of recent system events.',
  })
  @ApiOkResponse({ schema: { type: 'array', items: { type: 'object' } } }) // BYPASS-TYPING-TEST
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

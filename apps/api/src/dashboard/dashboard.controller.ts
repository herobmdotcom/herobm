import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { DashboardService } from './dashboard.service';
import {
  CasbinGuard,
  CasbinResource,
  CasbinAction,
} from '../auth/casbin.guard';

@Controller('dashboard')
@UseGuards(AuthGuard('jwt'), CasbinGuard)
@CasbinResource('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('summary')
  @CasbinAction('read')
  getSummary() {
    return this.dashboardService.getSummary();
  }

  @Get('search')
  @CasbinAction('read')
  search(@Query('q') q: string) {
    return this.dashboardService.universalSearch(q);
  }

  @Get('timeline')
  @CasbinAction('read')
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

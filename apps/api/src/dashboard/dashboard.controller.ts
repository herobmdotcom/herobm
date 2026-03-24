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
}

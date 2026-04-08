import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ReceptionsService } from './receptions.service';
import { AuthGuard } from '@nestjs/passport';
import { PaginationQuery } from '../common/pagination';
import {
  CasbinGuard,
  CasbinResource,
  CasbinAction,
} from '../auth/casbin.guard';

@UseGuards(AuthGuard('jwt'), CasbinGuard)
@Controller('receptions')
@CasbinResource('purchase-orders')
export class GlobalReceptionsController {
  constructor(private readonly receptionsService: ReceptionsService) {}

  @Get()
  @CasbinAction('read')
  async findAll(@Query() query: PaginationQuery) {
    return this.receptionsService.findAll(query);
  }
}

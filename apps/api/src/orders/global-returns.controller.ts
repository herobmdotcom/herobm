import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ReturnsWriteService } from './returns-write.service';
import {
  CasbinGuard,
  CasbinResource,
  CasbinAction,
} from '../auth/casbin.guard';

@Controller('sales-returns')
@UseGuards(AuthGuard('jwt'), CasbinGuard)
@CasbinResource('sales-orders')
export class GlobalReturnsController {
  constructor(private readonly returnsWriteService: ReturnsWriteService) {}

  @Get()
  @CasbinAction('read')
  async findGlobalReturns(@Query('stateCode') stateCode?: string) {
    const data = await this.returnsWriteService.findGlobal(stateCode);
    return { data, meta: { total: data.length } };
  }
}

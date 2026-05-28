import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiBody,
} from '@nestjs/swagger';
import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ReturnsWriteService } from './returns-write.service';
import {
  CasbinGuard,
  CasbinResource,
  CasbinAction,
} from '../auth/casbin.guard';

@ApiTags('Orders')
@Controller('sales-returns')
@UseGuards(AuthGuard('jwt'), CasbinGuard)
@CasbinResource('sales-orders')
export class GlobalReturnsController {
  constructor(private readonly returnsWriteService: ReturnsWriteService) {}

  @Get()
  @ApiOkResponse({ type: Object })
  @CasbinAction('read')
  @ApiOperation({
    summary: 'Find Global Returns',
    description:
      'Retrieve all sales returns across all orders, optionally filtered by state.',
  })
  async findGlobalReturns(@Query('stateCode') stateCode?: string) {
    const data = await this.returnsWriteService.findGlobal(stateCode);
    return { data, meta: { total: data.length } };
  }
}

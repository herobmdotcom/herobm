import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiBody,
  ApiQuery,
} from '@nestjs/swagger';
import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ReturnsWriteService } from './returns-write.service';
import { GlobalReturnListResponseDto } from './dto';
import {
  CasbinGuard,
  CasbinResource,
  CasbinAction,
} from '../auth/casbin.guard';

@ApiTags('Orders')
@Controller('sales-returns')
@UseGuards(AuthGuard(['jwt', 'api-key']), CasbinGuard)
@CasbinResource('sales-returns')
export class GlobalReturnsController {
  constructor(private readonly returnsWriteService: ReturnsWriteService) {}

  @Get()
  @ApiOkResponse({ type: GlobalReturnListResponseDto })
  @CasbinAction('read')
  @ApiOperation({
    summary: 'Find Global Returns',
    description:
      'Retrieve all sales returns across all orders, optionally filtered by state.',
  })
  @ApiQuery({ name: 'stateCode', required: false })
  async findGlobalReturns(@Query('stateCode') stateCode?: string) {
    const data = await this.returnsWriteService.findGlobal(stateCode);
    return { data, meta: { total: data.length } };
  }
}

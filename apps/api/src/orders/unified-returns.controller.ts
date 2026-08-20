import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiOkResponse } from '@nestjs/swagger';
import { GlobalReturnsService } from './global-returns.service';
import { GlobalReturnListResponseDto } from './dto';
import { PaginationQuery } from '../common/pagination.dto';
import { CasbinAction, CasbinResource } from '../auth/casbin.guard';
import { SystemResource } from '@herobm/shared';

@ApiTags('Unified Returns')
@CasbinResource(SystemResource.SALES_ORDERS)
@Controller('global-returns')
export class UnifiedReturnsController {
  constructor(private readonly globalReturnsService: GlobalReturnsService) {}

  @Get()
  @ApiOkResponse({ type: GlobalReturnListResponseDto })
  @CasbinAction('read')
  @ApiOperation({
    summary: 'Find Global Returns (Sales and Purchase)',
    description:
      'Retrieves a paginated list of global returns across both sales and purchase domains.',
  })
  async findGlobalReturns(@Query() query: PaginationQuery) {
    return this.globalReturnsService.findGlobalReturns(query);
  }
}

import { SystemResource } from '@herobm/shared';
import { Controller, Get, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CasbinAction, CasbinResource } from '../auth/casbin.guard';
import { PaginationQuery } from '../common/pagination.dto';
import { GlobalReturnListResponseDto } from './dto';
import { GlobalReturnsService } from './global-returns.service';

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

import { SystemResource } from '@herobm/shared';
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiQuery,
} from '@nestjs/swagger';
import { Controller, Get, Param, Query } from '@nestjs/common';
import { ReturnsWriteService } from './returns-write.service';
import { GlobalReturnListResponseDto, ReturnResponseDto } from './dto';
import {
  CasbinResource,
  CasbinAction,
} from '../auth/casbin.guard';

@ApiTags('Sales Returns')
@Controller('sales-returns')
@CasbinResource(SystemResource.SALES_RETURNS)
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
  @ApiQuery({ name: 'locationId', required: false })
  @ApiQuery({ name: 'requireCredit', required: false, type: Boolean })
  async findGlobalReturns(
    @Query('stateCode') stateCode?: string,
    @Query('locationId') locationId?: string,
    @Query('requireCredit') requireCredit?: boolean,
  ) {
    let data = await this.returnsWriteService.findGlobal(stateCode, locationId);

    if (requireCredit) {
      const filtered = [];
      for (const ret of data) {
        const creditTotal =
          await this.returnsWriteService.creditNoteService.calculateReturnCreditTotal(
            ret.returnId,
          );
        if (creditTotal > 0) {
          filtered.push(ret);
        }
      }
      data = filtered;
    }

    return { data, meta: { total: data.length } };
  }

  @Get(':id')
  @ApiOkResponse({ type: ReturnResponseDto })
  @CasbinAction('read')
  @ApiOperation({
    summary: 'Find Return by ID',
    description: 'Retrieve a specific sales return by its ID.',
  })
  async findOne(@Param('id') id: string) {
    return this.returnsWriteService.findOne(id);
  }
}

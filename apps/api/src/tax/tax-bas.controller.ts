import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiOkResponse,
} from '@nestjs/swagger';
import { TaxBasService } from './tax-bas.service';
import { BasSummaryQueryDto, BasSummaryRowDto } from './tax-bas.dto';
import { CasbinResource, CasbinAction } from '../auth/casbin.guard';
import { SystemResource } from '@herobm/shared';

@ApiTags('Tax')
@ApiBearerAuth()
@CasbinResource(SystemResource.GL)
@Controller('tax')
export class TaxBasController {
  constructor(private readonly taxBasService: TaxBasService) {}

  @Get('bas-summary')
  @CasbinAction('read')
  @ApiOperation({
    summary: 'Get ATO BAS Summary Report Data',
    description:
      'Returns the formatted ATO BAS summary for the specified date range',
  })
  @ApiOkResponse({
    description: 'Returns the ATO BAS Summary layout',
    type: [BasSummaryRowDto],
  })
  getBasSummary(@Query() query: BasSummaryQueryDto) {
    return this.taxBasService.getBasSummary(query);
  }
}

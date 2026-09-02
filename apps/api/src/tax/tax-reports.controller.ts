import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiOkResponse,
} from '@nestjs/swagger';
import { TaxReportsService } from './tax-reports.service';
import { TaxReportQueryDto, TaxReportResponseDto } from './tax-reports.dto';
import { CasbinResource, CasbinAction } from '../auth/casbin.guard';
import { SystemResource } from '@herobm/shared';

@ApiTags('Tax')
@ApiBearerAuth()
@CasbinResource(SystemResource.GL)
@Controller('tax')
export class TaxReportsController {
  constructor(private readonly taxReportsService: TaxReportsService) {}

  @Get('reports')
  @CasbinAction('read')
  @ApiOperation({
    summary: 'Get Tax Balances & Statutory Report Data',
    description:
      'Returns generic VAT/GST tax balances summary and country-specific statutory reports (ATO BAS, HMRC VAT, IRAS GST, USt-VA, NZ GST, US Sales Tax).',
  })
  @ApiOkResponse({
    description: 'Returns the structured tax balance and report data',
    type: TaxReportResponseDto,
  })
  getTaxReport(@Query() query: TaxReportQueryDto) {
    return this.taxReportsService.getTaxReport(query);
  }
}

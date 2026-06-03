import { SystemResource } from '@modbm/shared';
import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  UseGuards,
  Req,
  HttpCode,
  Put,
  Delete,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBody,
  ApiOkResponse,
  ApiCreatedResponse,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import {
  CasbinGuard,
  CasbinResource,
  CasbinAction,
} from '../auth/casbin.guard';
import {
  CreateBusinessReportDto,
  UpdateBusinessReportDto,
  BusinessReportResponseDto,
} from './business-reports.dto';
import { AuthUser, type JwtUser } from '../auth/auth-user.decorator';
import { BusinessReportsService } from './business-reports.service';

@ApiTags('Business Reports')
@Controller('business-reports')
@UseGuards(AuthGuard(['jwt', 'api-key']), CasbinGuard)
@CasbinResource(SystemResource.BUSINESS_REPORT)
export class BusinessReportsController {
  constructor(private readonly service: BusinessReportsService) {}

  @Get()
  @CasbinAction('read')
  @ApiOperation({
    summary: 'List available business reports',
    description: 'Returns a list of available business reports',
  })
  @ApiOkResponse({ type: [Object] }) // BYPASS-TYPING-TEST
  async getReports() {
    return this.service.getReports();
  }

  @Get('hooks')
  @CasbinAction('read')
  @ApiOperation({
    summary: 'List available data source hooks',
    description:
      'Returns a list of all registered business report data source hooks',
  })
  @ApiOkResponse({ type: [String] })
  async getHooks() {
    return this.service.getAvailableHooks();
  }

  @Post(':slug/data')
  @HttpCode(200)
  @CasbinAction('read')
  @ApiOperation({
    summary: 'Fetch data for a business report',
    description: 'Returns data for a specific business report',
  })
  @ApiBody({ type: Object }) // BYPASS-TYPING-TEST
  @ApiOkResponse({ type: [Object] }) // BYPASS-TYPING-TEST
  async runReport(
    @Param('slug') slug: string,
    // modbm-allow-record-any
    @Body() filters: Record<string, unknown>,
    @AuthUser() user: JwtUser,
  ) {
    const data = await this.service.runReport(slug, filters, user);
    return data;
  }

  @Get(':id')
  @CasbinAction('read')
  @ApiOperation({
    summary: 'Get a business report by ID',
    description: 'Returns the configuration for a specific business report',
  })
  @ApiOkResponse({ type: Object }) // BYPASS-TYPING-TEST
  async getReportById(@Param('id') id: string) {
    return this.service.getReportById(id);
  }

  @Post()
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Create a business report',
    description: 'Creates a new business report configuration',
  })
  @ApiBody({ type: CreateBusinessReportDto })
  @ApiCreatedResponse({ type: BusinessReportResponseDto })
  async createReport(@Body() data: CreateBusinessReportDto) {
    return this.service.createReport(data);
  }

  @Put(':id')
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Update a business report',
    description: 'Updates an existing business report configuration',
  })
  @ApiBody({ type: UpdateBusinessReportDto })
  @ApiOkResponse({ type: BusinessReportResponseDto })
  async updateReport(
    @Param('id') id: string,
    @Body() data: UpdateBusinessReportDto,
  ) {
    return this.service.updateReport(id, data);
  }

  @Delete(':id')
  @CasbinAction('archive')
  @ApiOperation({
    summary: 'Delete a business report',
    description: 'Deletes an existing business report configuration',
  })
  @ApiOkResponse({ type: Object }) // BYPASS-TYPING-TEST
  async deleteReport(@Param('id') id: string) {
    return this.service.deleteReport(id);
  }
}

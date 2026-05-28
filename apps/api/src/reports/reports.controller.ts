import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiBody,
} from '@nestjs/swagger';
import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Query,
  Res,
  Req,
  Body,
  Delete,
  UseGuards,
  UnauthorizedException,
  HttpCode,
} from '@nestjs/common';
import type { Response } from 'express';
import { ReportsService } from './reports.service';
import { AuthGuard } from '@nestjs/passport';
import {
  CasbinGuard,
  CasbinAction,
  CasbinResource,
} from '../auth/casbin.guard';

import {
  EmptyBodyDto,
  HooksResponseDto,
  HookAssignmentsResponseDto,
  RandomIdResponseDto,
  ReportsResponseDto,
  ReportResponseDto,
  CreateReportDto,
  UpdateReportDto,
  PreviewReportDto,
  UpdateHookAssignmentDto,
  RunHookBodyDto,
} from './dto';

@ApiTags('Reports')
@Controller('reports')
@UseGuards(AuthGuard(['jwt', 'api-key']), CasbinGuard)
@CasbinResource('report')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Post('hooks/:hookSlug/run')
  @CasbinAction('read')
  @ApiOperation({
    summary: 'Run Hook',
    description:
      'Execute a specific reporting hook and generate a PDF document.',
  })
  @ApiBody({ type: RunHookBodyDto })
  @HttpCode(200)
  @ApiOkResponse({
    // BYPASS-TYPING-TEST
    description: 'PDF Document',
    schema: { type: 'string', format: 'binary' },
  })
  async runHook(
    @Param('hookSlug') hookSlug: string,
    @Query('id') id: string,
    @Query('context') context: string,
    @Req() req: any,
    @Res() res: Response,
    @Body() body?: RunHookBodyDto,
  ) {
    if (!id || !context) {
      throw new UnauthorizedException('Missing id or context parameter');
    }

    const { pdfBuffer, fileName } = await this.reportsService.runHook(
      hookSlug,
      id,
      context,
      req.user,
      body,
    );

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${fileName}"`,
    });

    res.send(pdfBuffer);
  }

  @Get('hooks')
  @CasbinAction('read')
  @ApiOperation({
    summary: 'Get Hooks',
    description: 'Retrieve a list of available reporting hooks.',
  })
  @ApiOkResponse({ type: HooksResponseDto })
  async getHooks() {
    const data = await this.reportsService.getHooksList();
    return { data };
  }

  @Get('hook-assignments')
  @CasbinAction('read')
  @ApiOperation({
    summary: 'Get Hook Assignments',
    description: 'Retrieve current template assignments for reporting hooks.',
  })
  @ApiOkResponse({ type: HookAssignmentsResponseDto })
  async getAssignments() {
    const data = await this.reportsService.getAssignments();
    return { data };
  }

  @Patch('hook-assignments/:hook')
  @ApiBody({ type: UpdateHookAssignmentDto })
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Update Hook Assignment',
    description:
      'Update the assigned template and context for a reporting hook.',
  })
  @ApiOkResponse({ type: HookAssignmentsResponseDto })
  async updateAssignment(
    @Param('hook') hook: string,
    @Body() body: UpdateHookAssignmentDto,
  ) {
    const data = await this.reportsService.updateAssignment(
      hook,
      body.reportId || '',
      body.contextSlug || '',
    );
    return { data };
  }

  @Get('hooks/:slug/random-id')
  @CasbinAction('read')
  @ApiOkResponse({ type: RandomIdResponseDto })
  @ApiOperation({
    summary: 'Get Random ID',
    description:
      'Fetch a random valid entity ID for a given reporting context (used for previewing).',
  })
  async getRandomId(@Param('slug') slug: string) {
    const id = await this.reportsService.getRandomIdForContext(slug);
    return { data: { id } };
  }

  @Get()
  @CasbinAction('read')
  @ApiOperation({
    summary: 'Get All Reports',
    description: 'Retrieve a list of all configured report templates.',
  })
  @ApiOkResponse({ type: ReportsResponseDto })
  async getAllReports() {
    const data = await this.reportsService.getReports();
    return { data };
  }

  @Get(':id')
  @CasbinAction('read')
  @ApiOperation({
    summary: 'Get Report',
    description:
      'Retrieve the details and template content of a specific report.',
  })
  @ApiOkResponse({ type: ReportResponseDto })
  async getReport(@Param('id') id: string) {
    const data = await this.reportsService.getReportById(id);
    return { data };
  }

  @Post()
  @ApiBody({ type: CreateReportDto })
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Create Report',
    description: 'Create a new custom report template.',
  })
  @ApiCreatedResponse({ type: ReportResponseDto })
  async createReport(
    @Body()
    body: CreateReportDto,
  ) {
    const data = await this.reportsService.createReport(body);
    return { data };
  }

  @Patch(':id')
  @ApiBody({ type: UpdateReportDto })
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Update Report',
    description:
      'Modify the configuration or content of an existing report template.',
  })
  @ApiOkResponse({ type: ReportResponseDto })
  async updateReport(
    @Param('id') id: string,
    @Body()
    body: UpdateReportDto,
  ) {
    const data = await this.reportsService.updateReport(id, body);
    return { data };
  }

  @Delete(':id')
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Delete Report',
    description: 'Remove a report template from the system.',
  })
  @ApiOkResponse({ type: ReportResponseDto })
  async deleteReport(@Param('id') id: string) {
    const data = await this.reportsService.deleteReport(id);
    return { data };
  }

  @Post('preview')
  @ApiBody({ type: PreviewReportDto })
  @CasbinAction('read')
  @ApiOperation({
    summary: 'Preview Report',
    description:
      'Generate a preview PDF of a report template using mock or real entity data.',
  })
  @HttpCode(200)
  @ApiOkResponse({
    // BYPASS-TYPING-TEST
    description: 'PDF Document',
    schema: { type: 'string', format: 'binary' },
  })
  async preview(
    @Body()
    body: PreviewReportDto,
    @Req() req: any,
    @Res() res: Response,
  ) {
    const pdfBuffer = await this.reportsService.renderPreview(
      body.template,
      body.mockData,
      body.hookSlug,
      body.entityId,
      req.user,
    );

    res.set({ 'Content-Type': 'application/pdf' });
    res.send(pdfBuffer);
  }
}

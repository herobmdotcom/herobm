// security-ignore: dto-validation
import { SystemResource } from '@herobm/shared';
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
  Body,
  Delete,
  UnauthorizedException,
  HttpCode,
} from '@nestjs/common';
import type { Response } from 'express';
import { PdfTemplatesService } from './pdf-templates.service';
import { CasbinAction, CasbinResource } from '../auth/casbin.guard';
import { AuthUser, type JwtUser } from '../auth/auth-user.decorator';

import {
  CreateReportDto,
  UpdateReportDto,
  PreviewReportDto,
  UpdateHookAssignmentDto,
  RunHookBodyDto,
  HookDto,
  HookAssignmentDto,
  ReportDto,
  RandomIdData,
} from './dto';

@ApiTags('System')
@Controller('pdf-templates')
@CasbinResource(SystemResource.REPORT)
export class PdfTemplatesController {
  constructor(private readonly pdfTemplatesService: PdfTemplatesService) {}

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
    @AuthUser() user: JwtUser,
    @Res() res: Response,
    @Body() body?: Record<string, unknown>,
  ) {
    if (!id || !context) {
      throw new UnauthorizedException('Missing id or context parameter');
    }

    const { pdfBuffer, fileName } = await this.pdfTemplatesService.runHook(
      hookSlug,
      id,
      context,
      user,
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
  @ApiOkResponse({ type: [HookDto] })
  async getHooks() {
    return this.pdfTemplatesService.getHooksList();
  }

  @Get('hook-assignments')
  @CasbinAction('read')
  @ApiOperation({
    summary: 'Get Hook Assignments',
    description: 'Retrieve current template assignments for reporting hooks.',
  })
  @ApiOkResponse({ type: [HookAssignmentDto] })
  async getAssignments() {
    return this.pdfTemplatesService.getAssignments();
  }

  @Patch('hook-assignments/:hook')
  @ApiBody({ type: UpdateHookAssignmentDto })
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Update Hook Assignment',
    description:
      'Update the assigned template and context for a reporting hook.',
  })
  @ApiOkResponse({ type: HookAssignmentDto })
  async updateAssignment(
    @Param('hook') hook: string,
    @Body() body: UpdateHookAssignmentDto,
  ) {
    const data = await this.pdfTemplatesService.updateAssignment(
      hook,
      body.reportId || '',
      body.contextSlug || '',
    );
    return data;
  }

  @Get('hooks/:slug/random-id')
  @CasbinAction('read')
  @ApiOkResponse({ type: RandomIdData })
  @ApiOperation({
    summary: 'Get Random ID',
    description:
      'Fetch a random valid entity ID for a given reporting context (used for previewing).',
  })
  async getRandomId(@Param('slug') slug: string) {
    const id = await this.pdfTemplatesService.getRandomIdForContext(slug);
    return { id };
  }

  @Get()
  @CasbinAction('read')
  @ApiOperation({
    summary: 'Get All Reports',
    description: 'Retrieve a list of all configured report templates.',
  })
  @ApiOkResponse({ type: [ReportDto] })
  async getAllReports() {
    return this.pdfTemplatesService.getReports();
  }

  @Get(':id')
  @CasbinAction('read')
  @ApiOperation({
    summary: 'Get Report',
    description:
      'Retrieve the details and template content of a specific report.',
  })
  @ApiOkResponse({ type: ReportDto })
  async getReport(@Param('id') id: string) {
    const data = await this.pdfTemplatesService.getReportById(id);
    return data;
  }

  @Post()
  @ApiBody({ type: CreateReportDto })
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Create Report',
    description: 'Create a new custom report template.',
  })
  @ApiCreatedResponse({ type: ReportDto })
  async createReport(
    @Body()
    body: CreateReportDto,
  ) {
    const data = await this.pdfTemplatesService.createReport(body);
    return data;
  }

  @Patch(':id')
  @ApiBody({ type: UpdateReportDto })
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Update Report',
    description:
      'Modify the configuration or content of an existing report template.',
  })
  @ApiOkResponse({ type: ReportDto })
  async updateReport(
    @Param('id') id: string,
    @Body()
    body: UpdateReportDto,
  ) {
    const data = await this.pdfTemplatesService.updateReport(id, body);
    return data;
  }

  @Delete(':id')
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Delete Report',
    description: 'Remove a report template from the system.',
  })
  @ApiOkResponse({ type: ReportDto })
  async deleteReport(@Param('id') id: string) {
    const data = await this.pdfTemplatesService.deleteReport(id);
    return data;
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
    @AuthUser() user: JwtUser,
    @Res() res: Response,
  ) {
    const pdfBuffer = await this.pdfTemplatesService.renderPreview(
      body.template,
      body.mockData || {},
      body.hookSlug,
      body.entityId,
      user,
    );

    res.set({ 'Content-Type': 'application/pdf' });
    res.send(pdfBuffer);
  }
}

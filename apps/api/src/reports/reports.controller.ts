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
} from '@nestjs/common';
import type { Response } from 'express';
import { ReportsService } from './reports.service';
import { AuthGuard } from '@nestjs/passport';
import {
  CasbinGuard,
  CasbinAction,
  CasbinResource,
} from '../auth/casbin.guard';

@Controller('reports')
@UseGuards(AuthGuard('jwt'), CasbinGuard)
@CasbinResource('report')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Post('hooks/:hookSlug/run')
  @CasbinAction('read')
  async runHook(
    @Param('hookSlug') hookSlug: string,
    @Query('id') id: string,
    @Query('context') context: string,
    @Req() req: any,
    @Res() res: Response,
    @Body() body?: any,
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
  async getHooks() {
    const data = await this.reportsService.getHooksList();
    return { data };
  }

  @Get('hook-assignments')
  @CasbinAction('read')
  async getAssignments() {
    const data = await this.reportsService.getAssignments();
    return { data };
  }

  @Patch('hook-assignments/:hook')
  @CasbinAction('write')
  async updateAssignment(
    @Param('hook') hook: string,
    @Body() body: { reportId: string; contextSlug: string },
  ) {
    const data = await this.reportsService.updateAssignment(
      hook,
      body.reportId,
      body.contextSlug,
    );
    return { data };
  }

  @Get('hooks/:slug/random-id')
  @CasbinAction('read')
  async getRandomId(@Param('slug') slug: string) {
    const id = await this.reportsService.getRandomIdForContext(slug);
    return { data: { id } };
  }

  @Get()
  @CasbinAction('read')
  async getAllReports() {
    const data = await this.reportsService.getReports();
    return { data };
  }

  @Get(':id')
  @CasbinAction('read')
  async getReport(@Param('id') id: string) {
    const data = await this.reportsService.getReportById(id);
    return { data };
  }

  @Post()
  @CasbinAction('write')
  async createReport(
    @Body()
    body: {
      name: string;
      slug: string;
      description?: string;
      template: string;
      outputNamePattern?: string;
      contexts?: string[];
    },
  ) {
    const data = await this.reportsService.createReport(body);
    return { data };
  }

  @Patch(':id')
  @CasbinAction('write')
  async updateReport(
    @Param('id') id: string,
    @Body()
    body: {
      name?: string;
      slug?: string;
      description?: string;
      template?: string;
      outputNamePattern?: string;
      contexts?: string[];
    },
  ) {
    const data = await this.reportsService.updateReport(id, body);
    return { data };
  }

  @Delete(':id')
  @CasbinAction('write')
  async deleteReport(@Param('id') id: string) {
    const data = await this.reportsService.deleteReport(id);
    return { data };
  }

  @Post('preview')
  @CasbinAction('read')
  async preview(
    @Body()
    body: {
      template: string;
      mockData?: any;
      hookSlug?: string;
      entityId?: string;
    },
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

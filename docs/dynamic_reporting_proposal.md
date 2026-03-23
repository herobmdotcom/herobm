# Design Specification: Dynamic Report Engine

Status: Initial Draft
Engine: Typst (CLI-integrated)
Architecture Pattern: Intent-based "Hook" Registry

## Executive Summary
This design replaces the legacy hardcoded reporting services with a Metadata-Driven Report Engine. The core objective is to decouple the system’s "Intents" (e.g., the need to print an invoice) from the "Implementations" (the specific Typst template used).

By moving templates into the database and utilizing a many-to-many context mapping, the system enables users and AI agents to create, test, and deploy arbitrary reports for any entity without requiring API deployments or code changes.

##Key Architectural Pillars

The Hook Model (Android Intent Pattern): Standard system actions like SALES_INVOICE or PURCHASE_ORDER are treated as "Hooks." The UI calls the hook, and the API resolves which specific template is currently "plugged into" that slot. This allows for seamless template versioning and A/B testing.

Many-to-Many Context Discovery: Reports are tagged with one or more entity contexts (e.g., sales-order, warehouse-bin). This allows the UI to dynamically populate "More Reports" menus based on the record the user is currently viewing.

Agent-Native Workflow: The inclusion of a mock_data field and a /preview endpoint allows an AI agent to iterate on Typst code, render a PDF, and verify layout logic in a sandbox environment before saving to the production registry.

Decoupled Data Fetching: The engine uses the NestJS ModuleRef to dynamically resolve the appropriate data service based on the report's context, ensuring the report engine remains a generic utility rather than an entity-specific service.


## Technical Design: Dynamic Report Engine (Typst)

### 1. Database Schema

File: apps/api/src/drizzle/schema.ts

import { pgTable, text, varchar, timestamp, uuid, jsonb, primaryKey } from 'drizzle-orm/pg-core';

export const reports = pgTable('reports', {

  id: uuid('id').defaultRandom().primaryKey(),

  slug: varchar('slug', { length: 100 }).unique().notNull(),

  name: varchar('name', { length: 255 }).notNull(),

  template: text('template').notNull(),

  mockData: jsonb('mock_data').$type<Record<string, any>>(),

  outputNamePattern: varchar('output_name_pattern', { length: 255 }).default('Report.pdf'),

  createdAt: timestamp('created_at').defaultNow().notNull(),

});

export const reportContexts = pgTable('report_contexts', {

  reportId: uuid('report_id').references(() => reports.id, { onDelete: 'cascade' }).notNull(),

  context: varchar('context', { length: 50 }).notNull(),

}, (t) => ({

  pk: primaryKey({ columns: [t.reportId, t.context] }),

}));

export const reportHookAssignments = pgTable('report_hook_assignments', {

  hookSlug: varchar('hook_slug', { length: 100 }).primaryKey(),

  reportId: uuid('report_id').references(() => reports.id).notNull(),

  updatedAt: timestamp('updated_at').defaultNow().notNull(),

});

### 2. API Module
File: apps/api/src/reports/reports.module.ts

import { Module } from '@nestjs/common';

import { ReportsController } from './reports.controller';

import { ReportService } from './report.service';

import { DrizzleModule } from '../drizzle/drizzle.module';

@Module({

  imports: [DrizzleModule],

  controllers: [ReportsController],

  providers: [ReportService],

  exports: [ReportService],

})

export class ReportsModule {}

### 3. Controller (Discovery & Execution)
File: apps/api/src/reports/reports.controller.ts

import { Controller, Get, Post, Put, Param, Query, Body, Res, UseGuards } from '@nestjs/common';

import { Response } from 'express';

import { ReportService } from './report.service';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('reports')

@UseGuards(JwtAuthGuard)

export class ReportsController {

  constructor(private readonly reportService: ReportService) {}

  @Get()

  async findAll(@Query('context') context: string) {

    return this.reportService.findByContext(context);

  }

  @Put('hooks/:hookSlug')

  async updateHookAssignment(

    @Param('hookSlug') hookSlug: string,

    @Body('reportId') reportId: string

  ) {

    return this.reportService.assignReportToHook(hookSlug, reportId);

  }

  @Post('hooks/:hookSlug/run')

  async runHook(

    @Param('hookSlug') hookSlug: string,

    @Query('id') id: string,

    @Res() res: Response

  ) {

    const { pdfStream, fileName } = await this.reportService.runHook(hookSlug, id);

    res.set({

      'Content-Type': 'application/pdf',

      'Content-Disposition': `attachment; filename="${fileName}"`,

    });

    pdfStream.pipe(res);

  }

  @Post('preview')

  async preview(@Body() body: { template: string; mockData: any }, @Res() res: Response) {

    const pdfStream = await this.reportService.renderPreview(body.template, body.mockData);

    res.set({ 'Content-Type': 'application/pdf' });

    pdfStream.pipe(res);

  }

}

### 4. Service (The Engine)
File: apps/api/src/reports/report.service.ts

import { Injectable, NotFoundException, InternalServerErrorException } from '@nestjs/common';

import { ModuleRef } from '@nestjs/core';

import { DrizzleService } from '../drizzle/drizzle.service';

import { reports, reportContexts, reportHookAssignments } from '../drizzle/schema';

import { eq } from 'drizzle-orm';

import * as fs from 'fs';

import * as path from 'path';

import { exec } from 'child_process';

import { promisify } from 'util';

import { v4 as uuidv4 } from 'uuid';

const execAsync = promisify(exec);

@Injectable()

export class ReportService {

  constructor(

    private readonly drizzle: DrizzleService,

    private readonly moduleRef: ModuleRef

  ) {}

  async findByContext(context: string) {

    return this.drizzle.db

      .select({ id: reports.id, slug: reports.slug, name: reports.name })

      .from(reports)

      .innerJoin(reportContexts, eq(reports.id, reportContexts.reportId))

      .where(eq(reportContexts.context, context));

  }

  async assignReportToHook(hookSlug: string, reportId: string) {

    return this.drizzle.db

      .insert(reportHookAssignments)

      .values({ hookSlug, reportId })

      .onConflictDoUpdate({

        target: reportHookAssignments.hookSlug,

        set: { reportId, updatedAt: new Date() },

      });

  }

  async runHook(hookSlug: string, recordId: string) {

    const assignment = await this.drizzle.db.query.reportHookAssignments.findFirst({

      where: eq(reportHookAssignments.hookSlug, hookSlug),

      with: { report: true }

    });

    if (!assignment) throw new NotFoundException(`Hook ${hookSlug} not configured.`);

    const data = await this.fetchContextData(assignment.report.context, recordId);

    const pdfPath = await this.compileTypst(assignment.report.template, data);

    const fileName = this.formatOutputName(assignment.report.outputNamePattern, data);

    return { pdfStream: fs.createReadStream(pdfPath), fileName };

  }

  private async fetchContextData(context: string, id: string) {

    // Intent resolver maps contexts to existing services

    const serviceMap = {

      'sales-order': 'OrdersService',

      'purchase-order': 'PurchaseOrdersService',

    };

    const serviceName = serviceMap[context];

    if (!serviceName) throw new InternalServerErrorException(`No service for context: ${context}`);

    

    const service = this.moduleRef.get(serviceName, { strict: false });

    return service.findOne(id);

  }

  private async compileTypst(template: string, data: any): Promise<string> {

    const workDir = path.join(process.cwd(), 'tmp/reports');

    if (!fs.existsSync(workDir)) fs.mkdirSync(workDir, { recursive: true });

    const jobId = uuidv4();

    const typstFile = path.join(workDir, `${jobId}.typ`);

    const dataFile = path.join(workDir, `${jobId}.json`);

    const pdfFile = path.join(workDir, `${jobId}.pdf`);

    fs.writeFileSync(typstFile, template);

    fs.writeFileSync(dataFile, JSON.stringify(data));

    try {

      await execAsync(`typst compile ${typstFile} ${pdfFile}`);

      return pdfFile;

    } catch (error) {

      throw new InternalServerErrorException(`Typst Error: ${error.stderr}`);

    }

  }

  private formatOutputName(pattern: string, data: any): string {

    return pattern.replace(/\$\{(.+?)\}/g, (_, key) => data[key] || 'document');

  }

}

### 5. App Registration
File: apps/api/src/app.module.ts

import { ReportsModule } from './reports/reports.module';

@Module({

  imports: [

    // ... other modules

    ReportsModule,

  ],

})

export class AppModule {}


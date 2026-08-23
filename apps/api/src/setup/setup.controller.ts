import { SystemResource } from '@herobm/shared';
import {
  ApiTags,
  ApiConsumes,
  ApiOperation,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiBody,
} from '@nestjs/swagger';
import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  Res,
  UseGuards,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import type { Response } from 'express';
import { SetupService } from './setup.service';
import { CasbinResource, CasbinAction } from '../auth/casbin.guard';
import { AuthUser, type JwtUser } from '../auth/auth-user.decorator';
import { ThrottlerGuard, SkipThrottle } from '@nestjs/throttler';
import {
  ExecuteCsvDto,
  ExportCsvQueryDto,
  TestAbmConnectionDto,
  TestOdooConnectionDto,
  ExecuteEltDto,
  TestConnectionResultDto,
  ResumeStateDto,
  JobResultDto,
  ImportSummaryDto,
  CsvMetadataDto,
  JobProgressDto,
  SetupValidationDto,
  ActiveJobDto,
  SuccessResponseDto,
} from './setup.dto';
import { FileInterceptor } from '@nestjs/platform-express';

@ApiTags('System')
@Controller('setup')
@CasbinResource(SystemResource.IMPORT)
@UseGuards(ThrottlerGuard)
export class SetupController {
  constructor(private readonly setupService: SetupService) {}

  @Post('test-abm')
  @ApiBody({ type: TestAbmConnectionDto })
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Test ABM Connection',
    description: 'Tests connectivity to the legacy ABM database.',
  })
  @ApiCreatedResponse({ type: TestConnectionResultDto })
  async testAbm(@Body() dto: TestAbmConnectionDto) {
    return this.setupService.testAbmConnection(dto);
  }

  @Post('test-odoo')
  @ApiBody({ type: TestOdooConnectionDto })
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Test Odoo Connection',
    description: 'Tests connectivity to the legacy Odoo database.',
  })
  @ApiCreatedResponse({ type: TestConnectionResultDto })
  async testOdoo(@Body() dto: TestOdooConnectionDto) {
    return this.setupService.testOdooConnection(dto);
  }

  @Get('resume-state')
  @CasbinAction('read')
  @ApiOperation({
    summary: 'Get Resume State',
    description: 'Retrieves the resume state for ABM data migrations.',
  })
  @ApiOkResponse({ type: ResumeStateDto })
  async getResumeState() {
    return this.setupService.getResumeState();
  }

  @Get('resume-state-odoo')
  @CasbinAction('read')
  @ApiOperation({
    summary: 'Get Odoo Resume State',
    description: 'Retrieves the resume state for Odoo data migrations.',
  })
  @ApiOkResponse({ type: ResumeStateDto })
  async getResumeStateOdoo() {
    return this.setupService.getResumeStateOdoo();
  }

  @Post('execute-elt')
  @ApiBody({ type: ExecuteEltDto })
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Execute ELT Job',
    description: 'Triggers a data extraction and load pipeline job.',
  })
  @ApiCreatedResponse({ type: JobResultDto })
  async executeElt(@Body() dto: ExecuteEltDto) {
    return this.setupService.executeElt(dto);
  }

  @Get('active-job')
  @CasbinAction('read')
  @SkipThrottle()
  @ApiOperation({
    summary: 'Get Active Job',
    description:
      'Returns the ID and type of the currently running job, if any.',
  })
  @ApiOkResponse({ type: ActiveJobDto })
  async getActiveJob() {
    return this.setupService.getActiveJob();
  }

  @Delete('active-job/:jobId')
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Stop Active Job',
    description: 'Forcibly terminates a running background job.',
  })
  @ApiOkResponse({ type: SuccessResponseDto })
  async stopJob(@Param('jobId') jobId: string) {
    return this.setupService.stopJob(jobId);
  }

  @Get('progress/:jobId')
  @CasbinAction('read')
  @SkipThrottle()
  @ApiOperation({
    summary: 'Get Job Progress',
    description: 'Retrieves real-time progress for a background job.',
  })
  @ApiOkResponse({ type: JobProgressDto })
  async getProgress(@Param('jobId') jobId: string) {
    return this.setupService.getJobProgress(jobId);
  }

  @Get('validation')
  @CasbinAction('read')
  @ApiOperation({
    summary: 'Get Validation State',
    description: 'Retrieves validation summary for migrated data.',
  })
  @ApiOkResponse({ type: SetupValidationDto })
  async getValidation() {
    return this.setupService.getValidation();
  }

  @Get('import-summary')
  @CasbinAction('read')
  @ApiOperation({
    summary: 'Get Import Summary',
    description: 'Retrieves statistical summary of all imported data.',
  })
  @ApiOkResponse({ type: ImportSummaryDto })
  async getImportSummary() {
    return this.setupService.getImportSummary();
  }

  @Get('csv-metadata')
  @CasbinAction('read')
  @ApiOperation({
    summary: 'Get CSV Metadata',
    description: 'Retrieves metadata for configured CSV imports.',
  })
  @ApiOkResponse({ type: [CsvMetadataDto] })
  async getCsvMetadata() {
    return this.setupService.getCsvMetadata();
  }

  @Get('export-csv/:tableName')
  @CasbinAction('read')
  @ApiOperation({
    summary: 'Export Table as CSV',
    description:
      'Exports table records as a CSV file compatible with CSV import.',
  })
  @ApiOkResponse({
    description: 'CSV file download',
    schema: { type: 'string', format: 'binary' },
  })
  async exportCsv(
    @Param('tableName') tableName: string,
    @Query() dto: ExportCsvQueryDto,
    @AuthUser() user: JwtUser,
    @Res() res: Response,
  ) {
    return this.setupService.exportCsv(
      tableName,
      dto,
      res,
      user?.username || 'system',
    );
  }

  @Post('execute-csv')
  @UseInterceptors(FileInterceptor('file'))
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Execute CSV Import',
    description: 'Uploads and processes a CSV file for data import.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiCreatedResponse({ type: JobResultDto })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        tableName: { type: 'string' },
        strategy: { type: 'string' },
        file: {
          type: 'string',
          format: 'binary',
        },
      },
      required: ['tableName', 'strategy', 'file'],
    },
  })
  async executeCsv(
    @Body() dto: ExecuteCsvDto,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.setupService.executeCsv(dto.tableName, dto.strategy, file);
  }
}

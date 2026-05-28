import {
  ApiTags,
  ApiBearerAuth,
  ApiProperty,
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
  Body,
  Param,
  UseGuards,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { SetupService } from './setup.service';
import {
  CasbinResource,
  CasbinAction,
  CasbinGuard,
} from '../auth/casbin.guard';
import { AuthGuard } from '@nestjs/passport';
import { ThrottlerGuard, SkipThrottle } from '@nestjs/throttler';
import {
  ExecuteCsvDto,
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
} from './setup.dto';
import { FileInterceptor } from '@nestjs/platform-express';

@ApiTags('Setup')
@Controller('setup')
@CasbinResource('import')
@UseGuards(AuthGuard(['jwt', 'api-key']), CasbinGuard, ThrottlerGuard)
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
  @ApiOkResponse({ type: CsvMetadataDto, isArray: true })
  async getCsvMetadata() {
    return this.setupService.getCsvMetadata();
  }

  @Post('execute-csv')
  @UseInterceptors(FileInterceptor('file'))
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Execute CSV Import',
    description: 'Uploads and processes a CSV file for data import.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiCreatedResponse({ type: Object }) // BYPASS-TYPING-TEST
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
  @ApiCreatedResponse({ type: JobResultDto })
  async executeCsv(
    @Body() dto: ExecuteCsvDto,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.setupService.executeCsv(dto.tableName, dto.strategy, file);
  }
}

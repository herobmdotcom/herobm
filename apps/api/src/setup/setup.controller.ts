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
  ExecuteSetupDto,
  TestAbmConnectionDto,
  TestOdooConnectionDto,
  ExecuteEltDto,
} from './setup.dto';
import { FileInterceptor } from '@nestjs/platform-express';

@Controller('setup')
@CasbinResource('setup')
@UseGuards(AuthGuard('jwt'), CasbinGuard, ThrottlerGuard)
export class SetupController {
  constructor(private readonly setupService: SetupService) {}

  @Post('test-abm')
  @CasbinAction('execute')
  async testAbm(@Body() dto: TestAbmConnectionDto) {
    return this.setupService.testAbmConnection(dto);
  }

  @Post('test-odoo')
  @CasbinAction('execute')
  async testOdoo(@Body() dto: TestOdooConnectionDto) {
    return this.setupService.testOdooConnection(dto);
  }

  @Get('resume-state')
  @CasbinAction('read')
  async getResumeState() {
    return this.setupService.getResumeState();
  }

  @Get('resume-state-odoo')
  @CasbinAction('read')
  async getResumeStateOdoo() {
    return this.setupService.getResumeStateOdoo();
  }

  @Post('execute-elt')
  @CasbinAction('execute')
  async executeElt(@Body() dto: ExecuteEltDto) {
    return this.setupService.executeElt(dto);
  }

  @Get('progress/:jobId')
  @CasbinAction('read')
  @SkipThrottle()
  async getProgress(@Param('jobId') jobId: string) {
    return this.setupService.getJobProgress(jobId);
  }

  @Get('validation')
  @CasbinAction('read')
  async getValidation() {
    return this.setupService.getValidation();
  }

  @Get('import-summary')
  @CasbinAction('read')
  async getImportSummary() {
    return this.setupService.getImportSummary();
  }

  @Get('csv-metadata')
  @CasbinAction('read')
  async getCsvMetadata() {
    return this.setupService.getCsvMetadata();
  }

  @Post('execute-csv')
  @UseInterceptors(FileInterceptor('file'))
  @CasbinAction('execute')
  async executeCsv(
    @Body('tableName') tableName: string,
    @Body('strategy') strategy: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.setupService.executeCsv(tableName, strategy, file);
  }
}
